import secrets
import uuid
from datetime import UTC, datetime, timedelta

from app.models.client_invite import ClientInvite
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_client_invite(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.flush()

    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="client@example.com",
        token=secrets.token_urlsafe(32),
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db_session.add(invite)
    await db_session.flush()

    assert invite.email == "client@example.com"
    assert invite.accepted_at is None
    assert invite.organization_id == org.id
