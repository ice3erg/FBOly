from __future__ import annotations

from dataclasses import dataclass
import asyncio
import random
from typing import Any, Iterable, TypeVar

import httpx


class OzonApiError(RuntimeError):
    """Raised when Ozon Seller API returns an error or an unexpected response."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(slots=True)
class OzonProduct:
    offer_id: str
    sku: str | None
    name: str | None
    product_id: int | None = None
    raw: dict[str, Any] | None = None


T = TypeVar("T")


class OzonApiClient:
    """Small typed client for the Ozon Seller API endpoints used by this MVP."""

    def __init__(
        self,
        client_id: str,
        api_key: str,
        base_url: str = "https://api-seller.ozon.ru",
        timeout_seconds: float = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.headers = {
            "Client-Id": client_id,
            "Api-Key": api_key,
            "Content-Type": "application/json",
        }
        self._name_index: list[OzonProduct] | None = None
        self.max_retries = 4

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.post(url, headers=self.headers, json=payload)
            except httpx.HTTPError as exc:
                raise OzonApiError(
                    "Не удалось подключиться к Ozon API. "
                    "Проверьте интернет, DNS, VPN/прокси или блокировку антивирусом. "
                    f"Техническая причина: {exc}",
                ) from exc

            if response.status_code < 400:
                break

            if response.status_code == 429 and attempt < self.max_retries:
                await asyncio.sleep(get_retry_delay_seconds(response, attempt))
                continue

            message = (
                "Ozon временно ограничил частоту запросов. "
                "Подождите 10-20 секунд и повторите действие."
                if response.status_code == 429
                else f"Ozon API {path} returned {response.status_code}: {response.text[:500]}"
            )
            raise OzonApiError(message, status_code=response.status_code)
        else:
            raise OzonApiError("Ozon API did not respond after several retries")

        data = response.json()
        if not isinstance(data, dict):
            raise OzonApiError(f"Ozon API {path} returned a non-object response")
        return data

    async def get_product_list(
        self,
        limit: int = 1000,
        visibility: str = "ALL",
        last_id: str = "",
    ) -> dict[str, Any]:
        """Return a page from POST /v3/product/list."""

        payload = {
            "filter": {"visibility": visibility},
            "last_id": last_id,
            "limit": limit,
        }
        return await self._post("/v3/product/list", payload)

    async def get_all_product_list(self, limit: int = 1000) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        last_id = ""

        while True:
            page = await self.get_product_list(limit=limit, last_id=last_id)
            result = page.get("result") or {}
            page_items = result.get("items") or []
            if not isinstance(page_items, list):
                raise OzonApiError("Ozon product list response has invalid items")
            items.extend(page_items)

            next_last_id = result.get("last_id") or ""
            if not next_last_id or next_last_id == last_id or not page_items:
                break
            last_id = str(next_last_id)

        return items

    async def get_product_info_list(
        self,
        offer_ids: Iterable[str] | None = None,
        skus: Iterable[str | int] | None = None,
        product_ids: Iterable[int] | None = None,
    ) -> list[dict[str, Any]]:
        """Return product details from POST /v3/product/info/list."""

        payload: dict[str, Any] = {}
        offer_id_list = [value for value in (offer_ids or []) if str(value).strip()]
        sku_list = [int(value) for value in (skus or []) if str(value).strip().isdigit()]
        product_id_list = [int(value) for value in (product_ids or [])]

        if offer_id_list:
            payload["offer_id"] = offer_id_list
        if sku_list:
            payload["sku"] = sku_list
        if product_id_list:
            payload["product_id"] = product_id_list

        if not payload:
            return []

        try:
            data = await self._post("/v3/product/info/list", payload)
        except OzonApiError as exc:
            if exc.status_code != 404:
                raise
            data = await self._post("/v2/product/info/list", payload)
        result = data.get("result") or {}
        items = result.get("items") or []
        if not isinstance(items, list):
            raise OzonApiError("Ozon product info response has invalid items")
        return items

    async def get_stocks(
        self,
        offer_ids: Iterable[str] | None = None,
        product_ids: Iterable[int] | None = None,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        """Return product stock data from POST /v4/product/info/stocks."""

        filter_payload: dict[str, Any] = {"visibility": "ALL"}
        offer_id_list = [value for value in (offer_ids or []) if str(value).strip()]
        product_id_list = [int(value) for value in (product_ids or [])]
        if offer_id_list:
            filter_payload["offer_id"] = offer_id_list
        if product_id_list:
            filter_payload["product_id"] = product_id_list

        items: list[dict[str, Any]] = []
        last_id = ""
        while True:
            data = await self._post(
                "/v4/product/info/stocks",
                {"filter": filter_payload, "last_id": last_id, "limit": limit},
            )
            result = data.get("result") or {}
            page_items = result.get("items") or []
            if not isinstance(page_items, list):
                raise OzonApiError("Ozon stocks response has invalid items")
            items.extend(page_items)

            next_last_id = result.get("last_id") or ""
            if not next_last_id or next_last_id == last_id or not page_items:
                break
            last_id = str(next_last_id)
        return items

    async def get_warehouses(self) -> list[dict[str, Any]]:
        """Return seller warehouses from POST /v1/warehouse/list."""

        data = await self._post("/v1/warehouse/list", {})
        result = data.get("result")
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and isinstance(result.get("warehouses"), list):
            return result["warehouses"]
        raise OzonApiError("Ozon warehouse list response has invalid shape")

    async def find_product(
        self,
        offer_id: str | None = None,
        sku: str | None = None,
        name: str | None = None,
    ) -> OzonProduct | None:
        if offer_id:
            items = await self.get_product_info_list(offer_ids=[offer_id])
            product = self._first_product(items)
            if product:
                return product

        if sku:
            items = await self.get_product_info_list(skus=[sku])
            product = self._first_product(items)
            if product:
                return product

        if name:
            return await self.find_product_by_name(name)

        return None

    async def find_product_by_name(self, name: str) -> OzonProduct | None:
        needle = normalize_text(name)
        if not needle:
            return None

        products = await self._get_name_index()

        exact_match = next(
            (product for product in products if normalize_text(product.name) == needle),
            None,
        )
        if exact_match:
            return exact_match

        contains_match = next(
            (
                product
                for product in products
                if needle in normalize_text(product.name)
                or normalize_text(product.name) in needle
            ),
            None,
        )
        if contains_match:
            return contains_match

        return None

    async def _get_name_index(self) -> list[OzonProduct]:
        if self._name_index is not None:
            return self._name_index

        product_list = await self.get_all_product_list()
        product_ids = [
            int(item["product_id"])
            for item in product_list
            if str(item.get("product_id") or "").isdigit()
        ]

        products: list[OzonProduct] = []
        for chunk in chunks(product_ids, 100):
            info_items = await self.get_product_info_list(product_ids=chunk)
            for item in info_items:
                product = self._parse_product(item)
                if product:
                    products.append(product)

        self._name_index = products
        return products

    def build_supply_draft(
        self,
        warehouse_name: str,
        items: list[dict[str, str | int | None]],
    ) -> dict[str, Any]:
        """Prepare a future supply-creation payload without sending it to Ozon."""

        return {
            "warehouse_name": warehouse_name,
            "items": [
                {
                    "offer_id": item.get("offer_id"),
                    "sku": item.get("sku"),
                    "name": item.get("name"),
                    "quantity": item.get("quantity"),
                }
                for item in items
            ],
            "status": "draft",
            "note": "Prepared by MVP; extend this structure when enabling Ozon supply creation.",
        }

    def _first_product(self, items: list[dict[str, Any]]) -> OzonProduct | None:
        for item in items:
            product = self._parse_product(item)
            if product:
                return product
        return None

    def _parse_product(self, item: dict[str, Any]) -> OzonProduct | None:
        offer_id = item.get("offer_id")
        if not offer_id:
            return None

        sku_value = item.get("sku")
        if sku_value is None and isinstance(item.get("sources"), list):
            first_source = next((source for source in item["sources"] if source.get("sku")), None)
            sku_value = first_source.get("sku") if first_source else None

        product_id = item.get("product_id")
        parsed_product_id = int(product_id) if str(product_id or "").isdigit() else None
        return OzonProduct(
            offer_id=str(offer_id),
            sku=str(sku_value) if sku_value is not None else None,
            name=str(item.get("name")) if item.get("name") is not None else None,
            product_id=parsed_product_id,
            raw=item,
        )


def chunks(values: list[T], size: int) -> Iterable[list[T]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").casefold().strip().split())


def get_retry_delay_seconds(response: httpx.Response, attempt: int) -> float:
    retry_after = response.headers.get("retry-after")
    if retry_after:
        try:
            return max(float(retry_after), 0.5)
        except ValueError:
            pass
    return (2**attempt) + random.uniform(0, 0.25)
