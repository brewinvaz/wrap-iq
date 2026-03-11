import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment


class InvoiceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _generate_invoice_number(self, org_id: uuid.UUID) -> str:
        result = await self.session.execute(
            select(func.count(Invoice.id)).where(Invoice.organization_id == org_id)
        )
        count = result.scalar() or 0
        return f"INV-{count + 1001}"

    async def create(
        self,
        org_id: uuid.UUID,
        client_name: str,
        client_email: str,
        subtotal: int,
        tax_rate: Decimal = Decimal("0"),
        due_date=None,
        work_order_id: uuid.UUID | None = None,
        estimate_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> Invoice:
        invoice_number = await self._generate_invoice_number(org_id)
        tax_amount = int(subtotal * tax_rate / Decimal("100"))
        total = subtotal + tax_amount

        invoice = Invoice(
            id=uuid.uuid4(),
            organization_id=org_id,
            invoice_number=invoice_number,
            client_name=client_name,
            client_email=client_email,
            subtotal=subtotal,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            total=total,
            balance_due=total,
            due_date=due_date,
            work_order_id=work_order_id,
            estimate_id=estimate_id,
            notes=notes,
        )
        self.session.add(invoice)
        await self.session.commit()

        return await self.get(invoice.id, org_id)

    async def list(
        self,
        org_id: uuid.UUID,
        status_filter: InvoiceStatus | None = None,
    ) -> tuple[list[Invoice], int]:
        query = select(Invoice).where(Invoice.organization_id == org_id)
        count_query = select(func.count(Invoice.id)).where(
            Invoice.organization_id == org_id
        )

        if status_filter:
            query = query.where(Invoice.status == status_filter)
            count_query = count_query.where(Invoice.status == status_filter)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Invoice.created_at.desc())
        result = await self.session.execute(
            query.options(selectinload(Invoice.payments))
        )
        return list(result.scalars().all()), total

    async def get(self, invoice_id: uuid.UUID, org_id: uuid.UUID) -> Invoice | None:
        result = await self.session.execute(
            select(Invoice)
            .options(selectinload(Invoice.payments))
            .execution_options(populate_existing=True)
            .where(
                Invoice.id == invoice_id,
                Invoice.organization_id == org_id,
            )
        )
        return result.scalar_one_or_none()

    async def record_payment(
        self,
        invoice_id: uuid.UUID,
        org_id: uuid.UUID,
        amount: int,
        payment_method: str | None = None,
        reference: str | None = None,
        notes: str | None = None,
    ) -> Payment | None:
        invoice = await self.get(invoice_id, org_id)
        if not invoice:
            return None

        if amount <= 0:
            raise ValueError("Payment amount must be positive")

        if amount > invoice.balance_due:
            raise ValueError("Payment amount exceeds balance due")

        payment = Payment(
            id=uuid.uuid4(),
            organization_id=org_id,
            invoice_id=invoice.id,
            amount=amount,
            payment_method=payment_method,
            reference=reference,
            notes=notes,
        )
        self.session.add(payment)

        invoice.amount_paid += amount
        invoice.balance_due = invoice.total - invoice.amount_paid

        if invoice.balance_due == 0:
            invoice.status = InvoiceStatus.PAID
        elif invoice.amount_paid > 0:
            invoice.status = InvoiceStatus.PARTIAL

        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def generate_payment_link(
        self, invoice_id: uuid.UUID, org_id: uuid.UUID
    ) -> str | None:
        invoice = await self.get(invoice_id, org_id)
        if not invoice:
            return None

        token = uuid.uuid4().hex
        payment_link = f"/pay/{token}"
        invoice.payment_link = payment_link

        await self.session.commit()
        return payment_link
