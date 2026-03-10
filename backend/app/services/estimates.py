import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.estimate import Estimate, EstimateStatus
from app.models.estimate_line_item import EstimateLineItem
from app.models.invoice import Invoice


class EstimateService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _generate_estimate_number(self, org_id: uuid.UUID) -> str:
        result = await self.session.execute(
            select(func.count(Estimate.id)).where(Estimate.organization_id == org_id)
        )
        count = result.scalar() or 0
        return f"EST-{count + 1001}"

    def _compute_line_item_total(self, quantity: Decimal, unit_price: int) -> int:
        return round(quantity * unit_price)

    def _compute_totals(
        self, line_items: list[EstimateLineItem], tax_rate: Decimal
    ) -> tuple[int, int, int]:
        subtotal = sum(item.total for item in line_items)
        tax_amount = int(subtotal * tax_rate)
        total = subtotal + tax_amount
        return subtotal, tax_amount, total

    async def create(
        self,
        org_id: uuid.UUID,
        client_name: str,
        client_email: str,
        line_items: list[dict],
        tax_rate: Decimal = Decimal("0"),
        notes: str | None = None,
        work_order_id: uuid.UUID | None = None,
        valid_until: datetime | None = None,
    ) -> Estimate:
        estimate_number = await self._generate_estimate_number(org_id)

        estimate = Estimate(
            id=uuid.uuid4(),
            organization_id=org_id,
            client_name=client_name,
            client_email=client_email,
            estimate_number=estimate_number,
            tax_rate=tax_rate,
            notes=notes,
            work_order_id=work_order_id,
            valid_until=valid_until,
        )
        self.session.add(estimate)
        await self.session.flush()

        items = []
        for i, li in enumerate(line_items):
            quantity = li.get("quantity", Decimal("1"))
            unit_price = li["unit_price"]
            item = EstimateLineItem(
                id=uuid.uuid4(),
                estimate_id=estimate.id,
                description=li["description"],
                quantity=quantity,
                unit_price=unit_price,
                total=self._compute_line_item_total(quantity, unit_price),
                sort_order=li.get("sort_order", i),
            )
            self.session.add(item)
            items.append(item)

        subtotal, tax_amount, total = self._compute_totals(items, tax_rate)
        estimate.subtotal = subtotal
        estimate.tax_amount = tax_amount
        estimate.total = total

        await self.session.commit()

        return await self.get(estimate.id, org_id)

    async def list(
        self,
        org_id: uuid.UUID,
        status_filter: EstimateStatus | None = None,
    ) -> tuple[list[Estimate], int]:
        query = select(Estimate).where(Estimate.organization_id == org_id)
        count_query = select(func.count(Estimate.id)).where(
            Estimate.organization_id == org_id
        )

        if status_filter:
            query = query.where(Estimate.status == status_filter)
            count_query = count_query.where(Estimate.status == status_filter)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Estimate.created_at.desc())
        result = await self.session.execute(
            query.options(selectinload(Estimate.line_items))
        )
        return list(result.scalars().all()), total

    async def get(self, estimate_id: uuid.UUID, org_id: uuid.UUID) -> Estimate | None:
        result = await self.session.execute(
            select(Estimate)
            .options(selectinload(Estimate.line_items))
            .execution_options(populate_existing=True)
            .where(
                Estimate.id == estimate_id,
                Estimate.organization_id == org_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(
        self, estimate_id: uuid.UUID, org_id: uuid.UUID, **fields
    ) -> Estimate | None:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return None

        for key, value in fields.items():
            if value is not None:
                setattr(estimate, key, value)

        if "tax_rate" in fields:
            subtotal, tax_amount, total = self._compute_totals(
                estimate.line_items, estimate.tax_rate
            )
            estimate.subtotal = subtotal
            estimate.tax_amount = tax_amount
            estimate.total = total

        await self.session.commit()
        await self.session.refresh(estimate)
        return estimate

    async def add_line_item(
        self,
        estimate_id: uuid.UUID,
        org_id: uuid.UUID,
        description: str,
        quantity: Decimal = Decimal("1"),
        unit_price: int = 0,
    ) -> EstimateLineItem | None:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return None

        max_sort = max((item.sort_order for item in estimate.line_items), default=-1)

        item = EstimateLineItem(
            id=uuid.uuid4(),
            estimate_id=estimate.id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            total=self._compute_line_item_total(quantity, unit_price),
            sort_order=max_sort + 1,
        )
        self.session.add(item)
        await self.session.flush()

        await self.recalculate(estimate_id, org_id)
        await self.session.refresh(item)
        return item

    async def remove_line_item(
        self,
        line_item_id: uuid.UUID,
        estimate_id: uuid.UUID,
        org_id: uuid.UUID,
    ) -> bool:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return False

        item = None
        for li in estimate.line_items:
            if li.id == line_item_id:
                item = li
                break

        if not item:
            return False

        await self.session.delete(item)
        await self.session.flush()
        await self.recalculate(estimate_id, org_id)
        return True

    async def recalculate(
        self, estimate_id: uuid.UUID, org_id: uuid.UUID
    ) -> Estimate | None:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return None

        # Recompute each line item total
        for item in estimate.line_items:
            item.total = self._compute_line_item_total(item.quantity, item.unit_price)

        subtotal, tax_amount, total = self._compute_totals(
            estimate.line_items, estimate.tax_rate
        )
        estimate.subtotal = subtotal
        estimate.tax_amount = tax_amount
        estimate.total = total

        await self.session.commit()
        await self.session.refresh(estimate)
        return estimate

    async def send(self, estimate_id: uuid.UUID, org_id: uuid.UUID) -> Estimate | None:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return None

        estimate.status = EstimateStatus.SENT
        estimate.sent_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(estimate)
        return estimate

    async def convert_to_invoice(
        self, estimate_id: uuid.UUID, org_id: uuid.UUID
    ) -> Invoice | None:
        estimate = await self.get(estimate_id, org_id)
        if not estimate:
            return None

        if estimate.status != EstimateStatus.ACCEPTED:
            raise ValueError("Only accepted estimates can be converted to invoices")

        # Generate invoice number
        from app.services.invoices import InvoiceService

        invoice_service = InvoiceService(self.session)
        invoice_number = await invoice_service._generate_invoice_number(org_id)

        invoice = Invoice(
            id=uuid.uuid4(),
            organization_id=org_id,
            estimate_id=estimate.id,
            work_order_id=estimate.work_order_id,
            invoice_number=invoice_number,
            client_name=estimate.client_name,
            client_email=estimate.client_email,
            subtotal=estimate.subtotal,
            tax_rate=estimate.tax_rate,
            tax_amount=estimate.tax_amount,
            total=estimate.total,
            balance_due=estimate.total,
        )
        self.session.add(invoice)
        await self.session.commit()

        result = await self.session.execute(
            select(Invoice)
            .options(selectinload(Invoice.payments))
            .where(Invoice.id == invoice.id)
        )
        return result.scalar_one()
