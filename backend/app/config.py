from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Database
    database_url: str = Field(..., alias="DATABASE_URL")

    # JWT
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Email
    smtp_host: str = Field("smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT")
    smtp_user: str = Field(..., alias="SMTP_USER")
    smtp_pass: str = Field(..., alias="SMTP_PASS")
    smtp_from: str = Field("bsai24060@itu.edu.pk", alias="SMTP_FROM")

    # App
    app_name: str = Field("TradeFloor", alias="APP_NAME")
    frontend_url: str = Field("http://localhost:5173", alias="FRONTEND_URL")

    model_config = {"env_file": ".env", "populate_by_name": True}


settings = Settings()
