from __future__ import annotations

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.excel_service import (
    create_warehouse_files,
    parse_warehouse_percentages,
    read_incoming_items,
    resolve_items,
)
from app.models import ProcessResponse
from app.models import OzonConnectionCheckResponse, OzonCredentials
from app.ozon_api_client import OzonApiClient, OzonApiError

app = FastAPI(
    title="Ozon FBO Supply Automation MVP",
    version="0.1.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, bool | str]:
    return {
        "status": "ok",
        "api_credentials_configured": settings.has_ozon_credentials,
    }


@app.post("/api/process", response_model=ProcessResponse)
async def process_excel(
    file: UploadFile = File(...),
    warehouse_percentages: str | None = Form(default=None),
    ozon_client_id: str | None = Form(default=None),
    ozon_api_key: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
) -> ProcessResponse:
    try:
        warehouses = parse_warehouse_percentages(warehouse_percentages)
        items = await read_incoming_items(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ozon_client = build_ozon_client(
        settings=settings,
        client_id=ozon_client_id,
        api_key=ozon_api_key,
    )

    resolved_items, errors = await resolve_items(items, ozon_client)
    files, total_output_quantity = create_warehouse_files(resolved_items, warehouses)

    return ProcessResponse(
        files=files,
        errors=errors,
        resolved_items=resolved_items,
        total_input_quantity=sum(item.quantity for item in resolved_items),
        total_output_quantity=total_output_quantity,
        api_credentials_configured=ozon_client is not None,
    )


@app.post("/api/ozon/check", response_model=OzonConnectionCheckResponse)
async def check_ozon_connection(
    credentials: OzonCredentials,
    settings: Settings = Depends(get_settings),
) -> OzonConnectionCheckResponse:
    ozon_client = build_ozon_client(
        settings=settings,
        client_id=credentials.client_id,
        api_key=credentials.api_key,
    )
    if not ozon_client:
        raise HTTPException(status_code=400, detail="Введите Client-Id и Api-Key")

    try:
        await ozon_client.get_product_list(limit=1)
    except OzonApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OzonConnectionCheckResponse(
        ok=True,
        message="Подключение работает",
    )


def build_ozon_client(
    settings: Settings,
    client_id: str | None = None,
    api_key: str | None = None,
) -> OzonApiClient | None:
    clean_client_id = (client_id or "").strip() or settings.ozon_client_id
    clean_api_key = (api_key or "").strip() or settings.ozon_api_key

    if bool(clean_client_id) != bool(clean_api_key):
        raise HTTPException(status_code=400, detail="Введите Client-Id и Api-Key")
    if not clean_client_id or not clean_api_key:
        return None

    return OzonApiClient(
        client_id=clean_client_id,
        api_key=clean_api_key,
        base_url=settings.ozon_api_base_url,
        timeout_seconds=settings.request_timeout_seconds,
    )
