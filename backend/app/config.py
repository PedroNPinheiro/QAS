from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://qas:qas@localhost:5432/qas"
    secret_key: str = "dev-only-secret"
    access_token_expire_minutes: int = 720
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_mb: int = 25

    # Email notifications (no SMTP host configured = notifications disabled)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""  # defaults to smtp_user
    mail_bcc: str = ""  # comma-separated addresses silently copied on every notification
    app_base_url: str = "https://qas.cascointernal.com"

    # Microsoft Entra ID SSO (unset = Microsoft sign-in disabled)
    ms_client_id: str = ""
    ms_tenant_id: str = ""
    ms_client_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
