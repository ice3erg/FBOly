from pydantic import BaseModel, Field


class WarehousePercentage(BaseModel):
    name: str = Field(min_length=1)
    percentage: float = Field(ge=0)


class IncomingItem(BaseModel):
    row_number: int
    sku: str | None = None
    offer_id: str | None = None
    name: str | None = None
    quantity: int


class ResolvedItem(BaseModel):
    row_number: int
    offer_id: str
    name: str | None
    quantity: int
    source: str
    sku: str | None = None


class ProcessingError(BaseModel):
    row_number: int
    message: str
    input: dict[str, str | int | None]


class WarehouseFile(BaseModel):
    warehouse: str
    filename: str
    content_base64: str
    rows_count: int
    total_quantity: int


class ProcessResponse(BaseModel):
    files: list[WarehouseFile]
    errors: list[ProcessingError]
    resolved_items: list[ResolvedItem]
    total_input_quantity: int
    total_output_quantity: int
    api_credentials_configured: bool


class OzonCredentials(BaseModel):
    client_id: str | None = None
    api_key: str | None = None


class OzonConnectionCheckResponse(BaseModel):
    ok: bool
    message: str
