import uuid

from sqlalchemy import select

from app.models.plan import Plan


async def test_create_plan(db_session):
    plan = Plan(
        id=uuid.uuid4(),
        name="Free",
        features={"max_projects": 10},
        price_cents=0,
        is_default=True,
    )
    db_session.add(plan)
    await db_session.commit()

    result = await db_session.execute(select(Plan).where(Plan.name == "Free"))
    saved = result.scalar_one()
    assert saved.name == "Free"
    assert saved.price_cents == 0
    assert saved.is_default is True
    assert saved.features == {"max_projects": 10}
