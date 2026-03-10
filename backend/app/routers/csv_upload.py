from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.user import Role, User
from app.schemas.csv_upload import (
    CSVPreviewResponse,
    RowErrorResponse,
    UploadResultResponse,
)
from app.services.csv_upload import parse_csv, process_upload, validate_row

router = APIRouter(prefix="/api/csv-upload", tags=["csv-upload"])

ALLOWED_ROLES = {Role.ADMIN, Role.PROJECT_MANAGER}

TEMPLATE_CSV = (
    "client_name,client_email,vin,year,make,model,"
    "vehicle_type,job_type,job_value,priority,notes\n"
    "Acme Corp,contact@acme.com,1HGCM82633A004352,2023,Honda,Accord,"
    "car,Commercial,1500.00,High,Full wrap\n"
    "Bob's Plumbing,bob@plumbing.com,,2024,Ford,Transit,"
    "van,Commercial,2500.00,Medium,Fleet branding\n"
)


def _require_admin_or_pm(user: User) -> None:
    if user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and project managers can perform CSV uploads",
        )


@router.post("/upload", response_model=UploadResultResponse)
async def upload_csv(
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin_or_pm(user)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    result = await process_upload(user.organization_id, user.id, content, session)

    return UploadResultResponse(
        total_rows=result.total_rows,
        successful=result.successful,
        failed=result.failed,
        errors=[
            RowErrorResponse(row=e.row, field=e.field, message=e.message)
            for e in result.errors
        ],
        created_ids=result.created_work_order_ids,
    )


@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    _require_admin_or_pm(user)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    rows, parse_errors = parse_csv(content)

    validation_errors: list[RowErrorResponse] = []
    # Add parse-level errors
    for e in parse_errors:
        validation_errors.append(
            RowErrorResponse(row=e.row, field=e.field, message=e.message)
        )

    # Validate each row
    for idx, row in enumerate(rows):
        row_number = idx + 2
        row_errors = validate_row(row, row_number)
        for err in row_errors:
            field_name = ""
            for col in [
                "client_name",
                "job_type",
                "priority",
                "vehicle_type",
                "year",
                "job_value",
            ]:
                if col in err:
                    field_name = col
                    break
            validation_errors.append(
                RowErrorResponse(row=row_number, field=field_name, message=err)
            )

    # Get headers from first row or empty
    headers = list(rows[0].keys()) if rows else []
    sample_rows = rows[:5]

    return CSVPreviewResponse(
        headers=headers,
        sample_rows=sample_rows,
        total_rows=len(rows),
        validation_errors=validation_errors,
    )


@router.get("/template")
async def download_template(
    user: User = Depends(get_current_user),
):
    _require_admin_or_pm(user)

    return StreamingResponse(
        iter([TEMPLATE_CSV]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=work_orders_template.csv"
        },
    )
