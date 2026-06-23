from __future__ import annotations

import base64
import json
import math
from collections import defaultdict
from io import BytesIO
from typing import Any

import pandas as pd
from fastapi import UploadFile

from app.config import DEFAULT_WAREHOUSES
from app.models import (
    IncomingItem,
    ProcessingError,
    ResolvedItem,
    WarehouseFile,
    WarehousePercentage,
)
from app.ozon_api_client import OzonApiClient, OzonApiError

OZON_TEMPLATE_COLUMNS = ["артикул", "имя (необязательно)", "количество"]

SKU_ALIASES = {
    "sku ozon",
    "ozon sku",
    "sku",
    "озон sku",
    "sku озон",
    "озон id",
    "ozon id",
}
OFFER_ID_ALIASES = {
    "артикул",
    "offer_id",
    "offer id",
    "offerid",
    "vendor code",
    "код товара",
}
NAME_ALIASES = {
    "название",
    "название товара",
    "имя",
    "имя товара",
    "name",
    "product name",
    "товар",
}
QUANTITY_ALIASES = {
    "количество",
    "кол-во",
    "кол во",
    "qty",
    "quantity",
    "штук",
}


async def read_incoming_items(upload: UploadFile) -> list[IncomingItem]:
    contents = await upload.read()
    if not contents:
        raise ValueError("Загруженный файл пустой")

    try:
        dataframe = pd.read_excel(BytesIO(contents), dtype=object)
    except Exception as exc:
        raise ValueError(f"Не удалось прочитать Excel-файл: {exc}") from exc

    if dataframe.empty:
        raise ValueError("В Excel-файле нет строк с товарами")

    column_map = map_columns(dataframe.columns)
    if "quantity" not in column_map:
        raise ValueError("Не найдена колонка количества. Поддерживаются: количество, кол-во, qty, quantity")

    items: list[IncomingItem] = []
    for index, row in dataframe.iterrows():
        row_number = int(index) + 2
        sku = cell_to_text(row.get(column_map.get("sku"))) if column_map.get("sku") else None
        offer_id = (
            cell_to_text(row.get(column_map.get("offer_id"))) if column_map.get("offer_id") else None
        )
        name = cell_to_text(row.get(column_map.get("name"))) if column_map.get("name") else None
        quantity = parse_quantity(row.get(column_map["quantity"]))

        if not any([sku, offer_id, name]) and quantity is None:
            continue
        if quantity is None or quantity <= 0:
            raise ValueError(f"Строка {row_number}: количество должно быть положительным целым числом")
        if not any([sku, offer_id, name]):
            raise ValueError(f"Строка {row_number}: нужен SKU Ozon, артикул или название товара")

        items.append(
            IncomingItem(
                row_number=row_number,
                sku=sku,
                offer_id=offer_id,
                name=name,
                quantity=quantity,
            )
        )

    if not items:
        raise ValueError("Не найдено ни одной заполненной строки с товарами")
    return items


def parse_warehouse_percentages(raw: str | None) -> list[WarehousePercentage]:
    if not raw:
        warehouses = [
            WarehousePercentage(name=warehouse.name, percentage=warehouse.percentage)
            for warehouse in DEFAULT_WAREHOUSES
        ]
    else:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("warehouse_percentages должен быть JSON-массивом") from exc
        warehouses = [WarehousePercentage.model_validate(item) for item in parsed]

    cleaned = [warehouse for warehouse in warehouses if warehouse.name.strip()]
    total_percentage = sum(warehouse.percentage for warehouse in cleaned)
    if total_percentage <= 0:
        fallback_percentage = 100 / len(cleaned) if cleaned else 0
        return [
            WarehousePercentage(name=warehouse.name, percentage=fallback_percentage)
            for warehouse in cleaned
        ]
    return [
        WarehousePercentage(
            name=warehouse.name,
            percentage=warehouse.percentage / total_percentage * 100,
        )
        for warehouse in cleaned
    ]


async def resolve_items(
    items: list[IncomingItem],
    ozon_client: OzonApiClient | None,
) -> tuple[list[ResolvedItem], list[ProcessingError]]:
    resolved: list[ResolvedItem] = []
    errors: list[ProcessingError] = []

    for item in items:
        if item.offer_id:
            resolved.append(
                ResolvedItem(
                    row_number=item.row_number,
                    offer_id=item.offer_id,
                    name=item.name,
                    quantity=item.quantity,
                    source="excel_offer_id",
                    sku=item.sku,
                )
            )
            continue

        if not ozon_client:
            errors.append(
                ProcessingError(
                    row_number=item.row_number,
                    message="Для поиска по SKU или названию нужны OZON_CLIENT_ID и OZON_API_KEY",
                    input=item.model_dump(),
                )
            )
            continue

        try:
            product = await ozon_client.find_product(sku=item.sku, name=item.name)
        except OzonApiError as exc:
            errors.append(
                ProcessingError(
                    row_number=item.row_number,
                    message=f"Ошибка Ozon API: {exc}",
                    input=item.model_dump(),
                )
            )
            continue

        if not product:
            errors.append(
                ProcessingError(
                    row_number=item.row_number,
                    message="Товар не найден через Ozon Seller API",
                    input=item.model_dump(),
                )
            )
            continue

        resolved.append(
            ResolvedItem(
                row_number=item.row_number,
                offer_id=product.offer_id,
                name=product.name or item.name,
                quantity=item.quantity,
                source="ozon_api",
                sku=product.sku or item.sku,
            )
        )

    return resolved, errors


def distribute_quantity(quantity: int, warehouses: list[WarehousePercentage]) -> dict[str, int]:
    raw_distribution = [
        {
            "name": warehouse.name,
            "percentage": warehouse.percentage,
            "quantity": math.floor(quantity * warehouse.percentage / 100),
        }
        for warehouse in warehouses
    ]
    distributed = sum(item["quantity"] for item in raw_distribution)
    remainder = quantity - distributed

    if remainder > 0:
        by_priority = sorted(
            raw_distribution,
            key=lambda item: (-float(item["percentage"]), str(item["name"])),
        )
        for item in by_priority[:remainder]:
            item["quantity"] += 1

    return {str(item["name"]): int(item["quantity"]) for item in raw_distribution}


def create_warehouse_files(
    resolved_items: list[ResolvedItem],
    warehouses: list[WarehousePercentage],
) -> tuple[list[WarehouseFile], int]:
    rows_by_warehouse: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for item in resolved_items:
        distribution = distribute_quantity(item.quantity, warehouses)
        for warehouse_name, quantity in distribution.items():
            if quantity <= 0:
                continue
            rows_by_warehouse[warehouse_name].append(
                {
                    "артикул": item.offer_id,
                    "имя (необязательно)": item.name or "",
                    "количество": quantity,
                }
            )

    files: list[WarehouseFile] = []
    total_output_quantity = 0
    for warehouse in warehouses:
        rows = rows_by_warehouse.get(warehouse.name, [])
        dataframe = pd.DataFrame(rows, columns=OZON_TEMPLATE_COLUMNS)
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, sheet_name="Ozon FBO")
            worksheet = writer.sheets["Ozon FBO"]
            worksheet.column_dimensions["A"].width = 24
            worksheet.column_dimensions["B"].width = 42
            worksheet.column_dimensions["C"].width = 14

        warehouse_total = sum(int(row["количество"]) for row in rows)
        total_output_quantity += warehouse_total
        files.append(
            WarehouseFile(
                warehouse=warehouse.name,
                filename=f"Ozon_FBO_{warehouse.name}.xlsx",
                content_base64=base64.b64encode(buffer.getvalue()).decode("ascii"),
                rows_count=len(rows),
                total_quantity=warehouse_total,
            )
        )

    return files, total_output_quantity


def map_columns(columns: Any) -> dict[str, str]:
    mapped: dict[str, str] = {}
    for column in columns:
        normalized = normalize_column(column)
        if normalized in SKU_ALIASES:
            mapped.setdefault("sku", column)
        elif normalized in OFFER_ID_ALIASES:
            mapped.setdefault("offer_id", column)
        elif normalized in NAME_ALIASES:
            mapped.setdefault("name", column)
        elif normalized in QUANTITY_ALIASES:
            mapped.setdefault("quantity", column)
    return mapped


def normalize_column(value: Any) -> str:
    return " ".join(str(value or "").casefold().strip().replace("_", " ").split())


def cell_to_text(value: Any) -> str | None:
    if pd.isna(value):
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text or None


def parse_quantity(value: Any) -> int | None:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip().replace(" ", "").replace(",", ".")
        if not value:
            return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric <= 0 or not numeric.is_integer():
        return None
    return int(numeric)
