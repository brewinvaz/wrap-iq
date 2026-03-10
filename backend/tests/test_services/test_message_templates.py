import uuid

from app.models.message_template import ChannelType, TriggerType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.services.message_templates import MessageTemplateService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="user@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    return org, user


async def test_create_template(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="Project Started",
        subject="Your project {{project_name}} has started",
        body="Hello {{client_name}}, your project is underway.",
        trigger_type=TriggerType.MANUAL,
        channel=ChannelType.EMAIL,
    )

    assert template.name == "Project Started"
    assert template.organization_id == org.id
    assert template.trigger_type == TriggerType.MANUAL
    assert template.channel == ChannelType.EMAIL
    assert template.is_active is True


async def test_list_templates(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    for i in range(3):
        await service.create(
            organization_id=org.id,
            name=f"Template {i}",
            subject=f"Subject {i}",
            body=f"Body {i}",
            trigger_type=TriggerType.MANUAL,
        )

    templates = await service.list(org.id)
    assert len(templates) == 3


async def test_get_template(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    created = await service.create(
        organization_id=org.id,
        name="Test",
        subject="Subject",
        body="Body",
        trigger_type=TriggerType.MANUAL,
    )

    fetched = await service.get(created.id, org.id)
    assert fetched.id == created.id
    assert fetched.name == "Test"


async def test_get_template_not_found(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    import pytest

    with pytest.raises(ValueError, match="Template not found"):
        await service.get(uuid.uuid4(), org.id)


async def test_update_template(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    created = await service.create(
        organization_id=org.id,
        name="Original",
        subject="Original Subject",
        body="Original Body",
        trigger_type=TriggerType.MANUAL,
    )

    updated = await service.update(
        created.id, org.id, name="Updated", subject="New Subject"
    )
    assert updated.name == "Updated"
    assert updated.subject == "New Subject"
    assert updated.body == "Original Body"


async def test_delete_template(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    created = await service.create(
        organization_id=org.id,
        name="To Delete",
        subject="Subject",
        body="Body",
        trigger_type=TriggerType.MANUAL,
    )

    await service.delete(created.id, org.id)

    import pytest

    with pytest.raises(ValueError, match="Template not found"):
        await service.get(created.id, org.id)


async def test_render_template(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="Render Test",
        subject="Hello {{client_name}}",
        body="Project {{project_name}} is {{status}} at {{company_name}}.",
        trigger_type=TriggerType.MANUAL,
    )

    variables = {
        "client_name": "John",
        "project_name": "Tesla Wrap",
        "status": "completed",
        "company_name": "WrapIQ",
    }
    rendered_subject, rendered_body = service.render(template, variables)

    assert rendered_subject == "Hello John"
    assert rendered_body == "Project Tesla Wrap is completed at WrapIQ."


async def test_render_template_missing_variable(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="Render Missing",
        subject="Hello {{client_name}}",
        body="Project {{project_name}} status: {{unknown_var}}",
        trigger_type=TriggerType.MANUAL,
    )

    variables = {"client_name": "Jane", "project_name": "BMW Wrap"}
    rendered_subject, rendered_body = service.render(template, variables)

    assert rendered_subject == "Hello Jane"
    assert "{{unknown_var}}" in rendered_body


async def test_send_email(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="Send Test",
        subject="Hello {{client_name}}",
        body="Your project is ready.",
        trigger_type=TriggerType.MANUAL,
        channel=ChannelType.EMAIL,
    )

    log = await service.send(
        template_id=template.id,
        organization_id=org.id,
        recipient_email="client@example.com",
        variables={"client_name": "Alice"},
    )

    assert log.subject == "Hello Alice"
    assert log.recipient_email == "client@example.com"
    assert log.status.value == "sent"


async def test_send_in_app(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="In-App Test",
        subject="Notification",
        body="You have an update.",
        trigger_type=TriggerType.MANUAL,
        channel=ChannelType.IN_APP,
    )

    log = await service.send(
        template_id=template.id,
        organization_id=org.id,
        recipient_email="user@shop.com",
        recipient_user_id=user.id,
        variables={},
    )

    assert log.status.value == "sent"
    assert log.channel == ChannelType.IN_APP


async def test_send_both_channels(db_session):
    org, user = await _seed(db_session)
    service = MessageTemplateService(db_session)

    template = await service.create(
        organization_id=org.id,
        name="Both Test",
        subject="Update for {{client_name}}",
        body="Your project is done.",
        trigger_type=TriggerType.MANUAL,
        channel=ChannelType.BOTH,
    )

    log = await service.send(
        template_id=template.id,
        organization_id=org.id,
        recipient_email="user@shop.com",
        recipient_user_id=user.id,
        variables={"client_name": "Bob"},
    )

    assert log.status.value == "sent"
    assert log.channel == ChannelType.BOTH
    assert log.subject == "Update for Bob"
