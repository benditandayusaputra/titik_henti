from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from common import build_study_area_signature, BoundingBox, Configuration, announce
from ingest.overpass import fetch_overpass

VEHICLE_HIGHWAY_VALUES = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "living_street",
    "service",
    "road",
}


@dataclass(frozen=True)
class RoadLine:
    osm_id: int
    name: str | None
    highway: str
    coordinates: list[tuple[float, float]]

    @property
    def is_named_vehicle_road(self) -> bool:
        return self.highway in VEHICLE_HIGHWAY_VALUES and bool(self.name)


def build_road_query(box: BoundingBox) -> str:
    clause = box.as_overpass_clause()
    return (
        "[out:json][timeout:180];"
        f'way["highway"]({clause});'
        "out geom;"
    )


def ingest_road_network(configuration: Configuration) -> list[RoadLine]:
    analysis_box = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    payload: dict[str, Any] = fetch_overpass(
        "roads",
        build_road_query(analysis_box),
        configuration.overpass_endpoints,
        build_study_area_signature(configuration),
    )
    roads: list[RoadLine] = []
    for element in payload.get("elements") or []:
        geometry = element.get("geometry")
        if not geometry or len(geometry) < 2:
            continue
        tags = element.get("tags") or {}
        roads.append(
            RoadLine(
                osm_id=element["id"],
                name=tags.get("name"),
                highway=tags.get("highway", ""),
                coordinates=[(point["lon"], point["lat"]) for point in geometry],
            )
        )
    announce("ingest", f"ruas jalan OSM {len(roads)}")
    return roads
