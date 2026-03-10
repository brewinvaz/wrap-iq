import uuid

from app.models.file_upload import FileUpload
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_file_upload(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="u@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    upload = FileUpload(
        id=uuid.uuid4(),
        organization_id=org.id,
        uploaded_by=user.id,
        work_order_id=None,
        r2_key=f"{org.id}/onboarding/test/abc_photo.jpg",
        filename="photo.jpg",
        content_type="image/jpeg",
        size_bytes=102400,
    )
    db_session.add(upload)
    await db_session.flush()

    assert upload.r2_key.startswith(str(org.id))
    assert upload.size_bytes == 102400
    assert upload.content_type == "image/jpeg"
