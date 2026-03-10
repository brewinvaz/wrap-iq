from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/wrapiq"
    test_database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5433/wrapiq_test"
    )
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    debug: bool = True
    frontend_url: str = "http://localhost:3000"

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # AI / Gemini
    gemini_api_key: str = ""

    # Email
    resend_api_key: str = ""
    email_from: str = "WrapFlow <noreply@wrapflow.io>"

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "wrapiq-uploads"
    r2_public_url: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
