import re
import uuid

import resend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.message_log import MessageLog, MessageStatus
from app.models.message_template import ChannelType, MessageTemplate
from app.models.notification import NotificationType
from app.services.notifications import NotificationService


class MessageTemplateService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        organization_id: uuid.UUID,
        name: str,
        subject: str,
        body: str,
        trigger_type: str,
        trigger_stage_id: uuid.UUID | None = None,
        channel: str = "email",
        is_active: bool = True,
    ) -> MessageTemplate:
        template = MessageTemplate(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=name,
            subject=subject,
            body=body,
            trigger_type=trigger_type,
            trigger_stage_id=trigger_stage_id,
            channel=channel,
            is_active=is_active,
        )
        self.session.add(template)
        await self.session.commit()
        await self.session.refresh(template)
        return template

    async def list(self, organization_id: uuid.UUID) -> list[MessageTemplate]:
        result = await self.session.execute(
            select(MessageTemplate)
            .where(MessageTemplate.organization_id == organization_id)
            .order_by(MessageTemplate.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(
        self, template_id: uuid.UUID, organization_id: uuid.UUID
    ) -> MessageTemplate:
        result = await self.session.execute(
            select(MessageTemplate).where(
                MessageTemplate.id == template_id,
                MessageTemplate.organization_id == organization_id,
            )
        )
        template = result.scalar_one_or_none()
        if not template:
            raise ValueError("Template not found")
        return template

    async def update(
        self, template_id: uuid.UUID, organization_id: uuid.UUID, **kwargs
    ) -> MessageTemplate:
        template = await self.get(template_id, organization_id)
        for key, value in kwargs.items():
            if value is not None:
                setattr(template, key, value)
        await self.session.commit()
        await self.session.refresh(template)
        return template

    async def delete(self, template_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        template = await self.get(template_id, organization_id)
        await self.session.delete(template)
        await self.session.commit()

    def render(
        self, template: MessageTemplate, variables: dict[str, str]
    ) -> tuple[str, str]:
        """Replace {{variable}} placeholders in subject and body."""

        def replace_vars(text: str) -> str:
            def replacer(match: re.Match) -> str:
                key = match.group(1).strip()
                return variables.get(key, match.group(0))

            return re.sub(r"\{\{(\s*\w+\s*)\}\}", replacer, text)

        return replace_vars(template.subject), replace_vars(template.body)

    async def send(
        self,
        template_id: uuid.UUID,
        organization_id: uuid.UUID,
        recipient_email: str,
        recipient_user_id: uuid.UUID | None = None,
        variables: dict[str, str] | None = None,
    ) -> MessageLog:
        template = await self.get(template_id, organization_id)
        variables = variables or {}
        rendered_subject, rendered_body = self.render(template, variables)

        log = MessageLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            template_id=template_id,
            recipient_email=recipient_email,
            recipient_user_id=recipient_user_id,
            subject=rendered_subject,
            body=rendered_body,
            channel=template.channel,
            status=MessageStatus.PENDING,
        )
        self.session.add(log)

        try:
            if template.channel in (ChannelType.EMAIL, ChannelType.BOTH):
                await self._send_email(recipient_email, rendered_subject, rendered_body)

            if template.channel in (ChannelType.IN_APP, ChannelType.BOTH):
                if recipient_user_id:
                    notification_service = NotificationService(self.session)
                    await notification_service.create(
                        organization_id=organization_id,
                        user_id=recipient_user_id,
                        title=rendered_subject,
                        message=rendered_body,
                        notification_type=NotificationType.INFO,
                    )

            log.status = MessageStatus.SENT
        except Exception as e:
            log.status = MessageStatus.FAILED
            log.error_message = str(e)

        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def _send_email(self, to_email: str, subject: str, body: str) -> None:
        if not settings.resend_api_key:
            print(f"\n[DEV] Email to {to_email}: {subject}\n{body}\n")
            return

        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": subject,
                "html": body,
            }
        )
