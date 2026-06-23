from functools import lru_cache
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class WarehouseDistribution(BaseModel):
    name: str
    percentage: float


DEFAULT_WAREHOUSES: tuple[WarehouseDistribution, ...] = (
    WarehouseDistribution(name="Москва_Хоругвино", percentage=50),
    WarehouseDistribution(name="Санкт-Петербург", percentage=30),
    WarehouseDistribution(name="Казань", percentage=20),
)


class Settings(BaseSettings):
    ozon_client_id: str | None = None
    ozon_api_key: str | None = None
    ozon_api_base_url: str = "https://api-seller.ozon.ru"
    request_timeout_seconds: float = 30
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def has_ozon_credentials(self) -> bool:
        return bool(self.ozon_client_id and self.ozon_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
