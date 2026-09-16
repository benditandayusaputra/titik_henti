from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from shapely.geometry import LineString, Polygon

from common import build_study_area_signature, BoundingBox, Configuration, announce
from ingest.overpass import fetch_overpass

DEFAULT_WATERWAY_WIDTH_METERS = 9.0


@dataclass(frozen=True)
class RawWaterSource:
    osm_id: int
    kind: str
    label: str
    longitude: float
    latitude: float


def build_water_query(box: BoundingBox) -> str:
    clause = box.as_overpass_clause()
    return (
        "[out:json][timeout:180];("
        f'node["emergency"="fire_hydrant"]({clause});'
        f'node["emergency"="suction_point"]({clause});'
        f'node["emergency"="water_tank"]({clause});'
        f'node["man_made"="water_well"]({clause});'
        f'node["man_made"="water_tap"]({clause});'
        f'way["natural"="water"]({clause});'
        f'way["waterway"="river"]({clause});'
        f'way["waterway"="canal"]({clause});'
        ");out geom;"
    )


def classify_water_source(tags: dict[str, str]) -> tuple[str, str] | None:
    emergency = tags.get("emergency")
    if emergency == "fire_hydrant":
        return "hydrant", tags.get("ref") or "Hidran OSM"
    if emergency == "suction_point":
        return "openWater", tags.get("name") or "Titik hisap"
    if emergency == "water_tank":
        return "reservoir", tags.get("name") or "Tandon"
    man_made = tags.get("man_made")
    if man_made in ("water_well", "water_tap"):
        return "well", tags.get("name") or "Sumur"
    if tags.get("natural") == "water" or tags.get("waterway") in ("river", "canal"):
        return "openWater", tags.get("name") or "Air permukaan"
    return None


def sample_way_positions(geometry: list[dict[str, float]], stride: int) -> list[tuple[float, float]]:
    return [
        (point["lon"], point["lat"])
        for index, point in enumerate(geometry)
        if index % stride == 0
    ]


def ingest_water_obstacles(configuration: Configuration) -> list[LineString | Polygon]:
    analysis_box = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    payload: dict[str, Any] = fetch_overpass(
        "water",
        build_water_query(analysis_box),
        configuration.overpass_endpoints,
        build_study_area_signature(configuration),
    )
    obstacles: list[LineString | Polygon] = []
    for element in payload.get("elements") or []:
        if element["type"] != "way":
            continue
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        tags = element.get("tags") or {}
        coordinates = [(point["lon"], point["lat"]) for point in geometry]
        if tags.get("natural") == "water" and coordinates[0] == coordinates[-1] and len(coordinates) >= 4:
            obstacles.append(Polygon(coordinates))
        elif tags.get("waterway") in ("river", "canal"):
            obstacles.append(LineString(coordinates))
    announce("ingest", f"badan air penghalang {len(obstacles)}")
    return obstacles


def read_waterway_width_meters(tags: dict[str, str]) -> float:
    raw = tags.get("width")
    if raw:
        digits = "".join(character for character in raw if character.isdigit() or character == ".")
        if digits:
            try:
                return float(digits)
            except ValueError:
                pass
    return DEFAULT_WATERWAY_WIDTH_METERS


def ingest_water_sources(configuration: Configuration) -> list[RawWaterSource]:
    analysis_box = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    payload: dict[str, Any] = fetch_overpass(
        "water",
        build_water_query(analysis_box),
        configuration.overpass_endpoints,
        build_study_area_signature(configuration),
    )
    sources: list[RawWaterSource] = []
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        classified = classify_water_source(tags)
        if classified is None:
            continue
        kind, label = classified
        if element["type"] == "node":
            sources.append(
                RawWaterSource(element["id"], kind, label, element["lon"], element["lat"])
            )
            continue
        geometry = element.get("geometry") or []
        for longitude, latitude in sample_way_positions(geometry, 6):
            if analysis_box.contains(longitude, latitude):
                sources.append(RawWaterSource(element["id"], kind, label, longitude, latitude))

    announce("ingest", f"sumber air OSM {len(sources)}")
    return sources
