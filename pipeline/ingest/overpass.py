from __future__ import annotations

import time
from typing import Any

import requests

from common import (
    RAW_DIR,
    announce,
    cache_matches_study_area,
    read_json,
    record_cache_study_area,
    write_json,
)

REQUEST_TIMEOUT_SECONDS = 240
ATTEMPTS_PER_ENDPOINT = 2


def has_elements(payload: Any) -> bool:
    return isinstance(payload, dict) and bool(payload.get("elements"))


def fetch_overpass(
    name: str,
    query: str,
    endpoints: list[str],
    study_area_signature: str,
    require_elements: bool = True,
) -> Any:
    cache_path = RAW_DIR / f"osm_{name}.json"
    if cache_path.exists() and cache_matches_study_area(cache_path, study_area_signature):
        cached = read_json(cache_path)
        if has_elements(cached) or not require_elements:
            announce("ingest", f"memakai cache overpass {cache_path.name}")
            return cached

    failures: list[str] = []
    for attempt in range(len(endpoints) * ATTEMPTS_PER_ENDPOINT):
        endpoint = endpoints[attempt % len(endpoints)]
        try:
            response = requests.post(
                endpoint,
                data={"data": query},
                timeout=REQUEST_TIMEOUT_SECONDS,
                headers={"User-Agent": "titik-henti-pipeline/1.0"},
            )
            response.raise_for_status()
            payload = response.json()
            if require_elements and not has_elements(payload):
                raise RuntimeError("balasan overpass kosong")
            write_json(cache_path, payload)
            record_cache_study_area(cache_path, study_area_signature)
            announce("ingest", f"overpass {name} lewat {endpoint}")
            return payload
        except Exception as failure:
            failures.append(f"{endpoint}: {failure}")
            time.sleep(4)

    raise RuntimeError(f"overpass gagal untuk {name}\n" + "\n".join(failures))
