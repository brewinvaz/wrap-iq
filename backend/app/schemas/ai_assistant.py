import uuid

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    conversation_id: uuid.UUID | None = None


class QueryResponse(BaseModel):
    answer: str
    query_executed: str | None = None
    data: list[dict] | None = None
    conversation_id: uuid.UUID
