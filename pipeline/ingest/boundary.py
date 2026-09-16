from __future__ import annotations

from typing import Any

from shapely.geometry import MultiPolygon, Polygon, box
from shapely.ops import linemerge, polygonize, unary_union

from common import build_study_area_signature, Configuration, announce
from ingest.overpass import fetch_overpass


def build_boundary_query(relation_id: int) -> str:
    return f"[out:json][timeout:180];rel({relation_id});out geom;"


def assemble_relation_polygon(payload: dict[str, Any]) -> Polygon | MultiPolygon | None:
    elements = payload.get("elements") or []
    if not elements:
        return None
    members = elements[0].get("members") or []
    outer_lines = []
    inner_lines = []
    for member in members:
        geometry = member.get("geometry")
        if not geometry or len(geometry) < 2:
            continue
        coordinates = [(point["lon"], point["lat"]) for point in geometry]
        if member.get("role") == "inner":
            inner_lines.append(coordinates)
        else:
            outer_lines.append(coordinates)

    outer_polygons = list(polygonize(linemerge(outer_lines))) if outer_lines else []
    if not outer_polygons:
        return None
    inner_polygons = list(polygonize(linemerge(inner_lines))) if inner_lines else []
    merged = unary_union(outer_polygons)
    if inner_polygons:
        merged = merged.difference(unary_union(inner_polygons))
    return merged


def ingest_village_boundary(configuration: Configuration) -> Polygon | MultiPolygon:
    relation_id = configuration.boundary_relation_id
    if relation_id:
        payload = fetch_overpass(
            "boundary",
            build_boundary_query(relation_id),
            configuration.overpass_endpoints,
            build_study_area_signature(configuration),
        )
        polygon = assemble_relation_polygon(payload)
        if polygon is not None and not polygon.is_empty:
            announce("ingest", f"batas kelurahan dari relasi OSM {relation_id}")
            return polygon
    announce("ingest", "batas kelurahan memakai bounding box konfigurasi")
    limits = configuration.bounding_box
    return box(limits.west, limits.south, limits.east, limits.north)
