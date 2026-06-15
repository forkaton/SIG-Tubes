from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Local default — di Vercel di-override via env var DATABASE_URL.
    # Format Supabase pooler:
    #   postgresql+psycopg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/sig_tmp_pekanbaru"
    # Comma-separated origins. "*" untuk allow all (set di Vercel kalau perlu).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        items = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return items or ["*"]


settings = Settings()
