from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
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
