import csv
import io
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kanban_stage import KanbanStage
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle
from app.services.work_orders import generate_job_number

EXPECTED_COLUMNS = [
    "client_name",
    "client_email",
    "vin",
    "year",
    "make",
    "model",
    "vehicle_type",
    "job_type",
    "job_value",
    "priority",
    "notes",
]

REQUIRED_COLUMNS = ["client_name"]

VALID_JOB_TYPES = {"commercial", "personal"}
VALID_PRIORITIES = {"high", "medium", "low"}
VALID_VEHICLE_TYPES = {vt.value for vt in VehicleType}


@dataclass
class RowError:
    row: int
    field: str
    message: str


@dataclass
class UploadResult:
    total_rows: int
    successful: int
    failed: int
    errors: list[RowError] = field(default_factory=list)
    created_work_order_ids: list[uuid.UUID] = field(default_factory=list)


def parse_csv(
    file_content: bytes,
) -> tuple[list[dict[str, str]], list[RowError]]:
    """Parse CSV content, validate headers, return rows and any errors."""
    errors: list[RowError] = []

    text = file_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        errors.append(RowError(row=0, field="", message="CSV file is empty"))
        return [], errors

    # Normalize headers to lowercase and strip whitespace
    headers = [h.strip().lower() for h in reader.fieldnames]

    # Check required columns exist
    for col in REQUIRED_COLUMNS:
        if col not in headers:
            errors.append(
                RowError(
                    row=0,
                    field=col,
                    message=f"Required column '{col}' is missing",
                )
            )

    if errors:
        return [], errors

    rows: list[dict[str, str]] = []
    for raw_row in reader:
        # Normalize keys
        normalized = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        rows.append(normalized)

    return rows, errors


def validate_row(row: dict[str, str], row_number: int) -> list[str]:
    """Validate a single CSV row. Returns list of error messages."""
    errors: list[str] = []

    # Required fields
    if not row.get("client_name"):
        errors.append("client_name is required")

    # Validate job_type if provided
    job_type = row.get("job_type", "").strip().lower()
    if job_type and job_type not in VALID_JOB_TYPES:
        errors.append(
            f"Invalid job_type '{row.get('job_type')}'. Must be Commercial or Personal"
        )

    # Validate priority if provided
    priority = row.get("priority", "").strip().lower()
    if priority and priority not in VALID_PRIORITIES:
        errors.append(
            f"Invalid priority '{row.get('priority')}'. Must be High, Medium, or Low"
        )

    # Validate vehicle_type if provided
    vehicle_type = row.get("vehicle_type", "").strip().lower()
    if vehicle_type and vehicle_type not in VALID_VEHICLE_TYPES:
        # Also accept display names like "Box Truck" -> "box_truck"
        normalized = vehicle_type.replace(" ", "_")
        if normalized not in VALID_VEHICLE_TYPES:
            errors.append(
                f"Invalid vehicle_type '{row.get('vehicle_type')}'. "
                f"Must be one of: {', '.join(vt.value for vt in VehicleType)}"
            )

    # Validate year if provided
    year = row.get("year", "").strip()
    if year:
        try:
            int(year)
        except ValueError:
            errors.append(f"Invalid year '{year}'. Must be a number")

    # Validate job_value if provided
    job_value = row.get("job_value", "").strip()
    if job_value:
        try:
            val = float(job_value)
            if val < 0:
                errors.append("job_value must not be negative")
        except ValueError:
            errors.append(f"Invalid job_value '{job_value}'. Must be a number")

    return errors


def _parse_vehicle_type(raw: str) -> VehicleType | None:
    """Parse a vehicle type string to the VehicleType enum."""
    if not raw:
        return None
    normalized = raw.strip().lower().replace(" ", "_")
    try:
        return VehicleType(normalized)
    except ValueError:
        return None


async def _get_default_stage(
    session: AsyncSession, org_id: uuid.UUID
) -> KanbanStage | None:
    """Get the first active kanban stage by position for an org."""
    result = await session.execute(
        select(KanbanStage)
        .where(
            KanbanStage.organization_id == org_id,
            KanbanStage.is_active.is_(True),
        )
        .order_by(KanbanStage.position)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _find_or_create_vehicle(
    session: AsyncSession,
    org_id: uuid.UUID,
    vin: str | None,
    year: int | None,
    make: str | None,
    model: str | None,
    vehicle_type: VehicleType | None,
) -> Vehicle:
    """Find an existing vehicle by VIN within org, or create a new one."""
    if vin:
        result = await session.execute(
            select(Vehicle).where(
                Vehicle.organization_id == org_id,
                Vehicle.vin == vin.upper(),
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org_id,
        vin=vin.upper() if vin else None,
        year=year,
        make=make,
        model=model,
        vehicle_type=vehicle_type,
    )
    session.add(vehicle)
    await session.flush()
    return vehicle


async def process_upload(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    file_content: bytes,
    session: AsyncSession,
) -> UploadResult:
    """Full pipeline: parse -> validate -> create vehicles -> create work orders."""
    rows, parse_errors = parse_csv(file_content)

    if parse_errors:
        return UploadResult(
            total_rows=0,
            successful=0,
            failed=0,
            errors=parse_errors,
            created_work_order_ids=[],
        )

    # Get default kanban stage
    default_stage = await _get_default_stage(session, org_id)
    if not default_stage:
        return UploadResult(
            total_rows=len(rows),
            successful=0,
            failed=len(rows),
            errors=[
                RowError(
                    row=0,
                    field="",
                    message="No active Kanban stages configured for this organization",
                )
            ],
            created_work_order_ids=[],
        )

    result = UploadResult(
        total_rows=len(rows),
        successful=0,
        failed=0,
    )

    for idx, row in enumerate(rows):
        row_number = idx + 2  # 1-indexed, plus header row
        validation_errors = validate_row(row, row_number)

        if validation_errors:
            for err in validation_errors:
                # Try to extract field name from error message
                field_name = ""
                for col in EXPECTED_COLUMNS:
                    if col in err:
                        field_name = col
                        break
                result.errors.append(
                    RowError(row=row_number, field=field_name, message=err)
                )
            result.failed += 1
            continue

        try:
            # Parse fields
            vin = row.get("vin", "").strip() or None
            year_str = row.get("year", "").strip()
            year = int(year_str) if year_str else None
            make = row.get("make", "").strip() or None
            model = row.get("model", "").strip() or None
            vehicle_type = _parse_vehicle_type(row.get("vehicle_type", ""))

            # If VIN provided and year/make/model missing, try VIN lookup
            if vin and not all([year, make, model]):
                try:
                    from app.services.vin import decode_vin

                    vin_info = await decode_vin(vin)
                    if not year and vin_info.year:
                        year = vin_info.year
                    if not make and vin_info.make:
                        make = vin_info.make
                    if not model and vin_info.model:
                        model = vin_info.model
                    if not vehicle_type:
                        # Map schema VehicleType to model VehicleType
                        vt_str = vin_info.vehicle_type.value.lower().replace(" ", "_")
                        try:
                            vehicle_type = VehicleType(vt_str)
                        except ValueError:
                            pass
                except Exception:
                    # VIN lookup failure is non-fatal
                    pass

            # Create or find vehicle (only if we have any vehicle info)
            vehicle_id = None
            if any([vin, year, make, model, vehicle_type]):
                vehicle = await _find_or_create_vehicle(
                    session, org_id, vin, year, make, model, vehicle_type
                )
                vehicle_id = vehicle.id

            # Parse work order fields
            job_type_str = row.get("job_type", "").strip().lower()
            job_type = JobType(job_type_str) if job_type_str else JobType.commercial

            priority_str = row.get("priority", "").strip().lower()
            priority = Priority(priority_str) if priority_str else Priority.medium

            job_value_str = row.get("job_value", "").strip()
            job_value = 0
            if job_value_str:
                # Convert dollars to cents
                job_value = int(round(float(job_value_str) * 100))

            # Build notes with client info
            client_name = row.get("client_name", "").strip()
            client_email = row.get("client_email", "").strip()
            notes = row.get("notes", "").strip()
            internal_notes_parts = [f"Client: {client_name}"]
            if client_email:
                internal_notes_parts.append(f"Email: {client_email}")
            if notes:
                internal_notes_parts.append(notes)
            internal_notes = "\n".join(internal_notes_parts)

            # Generate job number and create work order
            job_number = await generate_job_number(session, org_id)

            wo = WorkOrder(
                id=uuid.uuid4(),
                organization_id=org_id,
                job_number=job_number,
                status_id=default_stage.id,
                job_type=job_type,
                job_value=job_value,
                priority=priority,
                date_in=datetime.now(UTC),
                internal_notes=internal_notes,
            )
            session.add(wo)
            await session.flush()

            # Link vehicle if created
            if vehicle_id:
                session.add(
                    WorkOrderVehicle(work_order_id=wo.id, vehicle_id=vehicle_id)
                )
                await session.flush()

            result.successful += 1
            result.created_work_order_ids.append(wo.id)

        except Exception as e:
            result.failed += 1
            result.errors.append(RowError(row=row_number, field="", message=str(e)))

    # Commit all successful rows
    if result.successful > 0:
        await session.commit()

    return result
