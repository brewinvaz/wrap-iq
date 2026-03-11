import re

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        errors: list[str] = []
        if not re.search(r"[A-Z]", v):
            errors.append("at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("at least one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("at least one digit")
        if errors:
            raise ValueError(
                "Password must contain " + ", ".join(errors) + "."
            )
        return v
    org_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkVerify(BaseModel):
    token: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None


class MessageResponse(BaseModel):
    message: str
