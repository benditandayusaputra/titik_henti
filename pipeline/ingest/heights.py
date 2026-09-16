from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from common import build_study_area_signature, BoundingBox, Configuration, announce
from ingest.overpass import fetch_overpass

METERS_PER_BUILDING_LEVEL = 3.2
FALLBACK_HEIGHT_METERS = 4.5
MINIMUM_SAMPLES_FOR_REGRESSION = 12
AREA_BUCKET_EDGES_SQUARE_METERS = (30.0, 60.0, 120.0, 250.0)


@dataclass(frozen=True)
class TaggedBuildingHeight:
    longitude: float
    latitude: float
    height_meters: float
    material: str | None


def build_tagged_building_query(box: BoundingBox) -> str:
    clause = box.as_overpass_clause()
    return (
        "[out:json][timeout:180];("
        f'way["building"]["height"]({clause});'
        f'way["building"]["building:levels"]({clause});'
        f'way["building"]["building:material"]({clause});'
        ");out center tags;"
    )


def parse_height_meters(tags: dict[str, str]) -> float | None:
    raw_height = tags.get("height")
    if raw_height:
        digits = "".join(character for character in raw_height if character.isdigit() or character == ".")
        if digits:
            try:
                return float(digits)
            except ValueError:
                pass
    raw_levels = tags.get("building:levels")
    if raw_levels:
        digits = "".join(character for character in raw_levels if character.isdigit() or character == ".")
        if digits:
            try:
                return float(digits) * METERS_PER_BUILDING_LEVEL
            except ValueError:
                pass
    return None


def ingest_tagged_building_heights(configuration: Configuration) -> list[TaggedBuildingHeight]:
    analysis_box = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    payload: dict[str, Any] = fetch_overpass(
        "building_tags",
        build_tagged_building_query(analysis_box),
        configuration.overpass_endpoints,
        build_study_area_signature(configuration),
    )
    samples: list[TaggedBuildingHeight] = []
    for element in payload.get("elements") or []:
        center = element.get("center")
        if not center:
            continue
        tags = element.get("tags") or {}
        height = parse_height_meters(tags)
        if height is None or height <= 0:
            continue
        samples.append(
            TaggedBuildingHeight(
                longitude=center["lon"],
                latitude=center["lat"],
                height_meters=height,
                material=tags.get("building:material"),
            )
        )
    announce("ingest", f"bangunan bertinggi terdata OSM {len(samples)}")
    return samples


def locate_height_raster(configuration: Configuration) -> Path | None:
    configured = configuration.height_raster_path
    if not configured:
        return None
    candidate = Path(configured)
    return candidate if candidate.exists() else None
