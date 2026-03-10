import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.message_log import MessageStatus
from app.models.message_template import ChannelType, TriggerType


class MessageTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str
    trigger_type: TriggerType = TriggerType.MANUAL
    trigger_stage_id: uuid.UUID | None = None
    channel: ChannelType = ChannelType.EMAIL
    is_active: bool = True


class MessageTemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None
    trigger_type: TriggerType | None = None
    trigger_stage_id: uuid.UUID | None = None
    channel: ChannelType | None = None
    is_active: bool | None = None


class MessageTemplateResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    subject: str
    body: str
    trigger_type: TriggerType
    trigger_stage_id: uuid.UUID | None
    channel: ChannelType
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageTemplateListResponse(BaseModel):
    items: list[MessageTemplateResponse]


class SendMessageRequest(BaseModel):
    recipient_email: str
    recipient_user_id: uuid.UUID | None = None
    variables: dict[str, str] = {}


class MessageLogResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    template_id: uuid.UUID | None
    recipient_email: str
    recipient_user_id: uuid.UUID | None
    subject: str
    body: str
    channel: ChannelType
    status: MessageStatus
    sent_at: datetime
    error_message: str | None

    model_config = {"from_attributes": True}
