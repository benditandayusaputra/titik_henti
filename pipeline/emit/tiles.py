from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import transform as transform_geometry

from common import OUTPUT_DIR, WORK_DIR, MetricProjection, announce
from derive.alleys import AlleySegment
from derive.buildings import BuildingRecord

TILE_MIN_ZOOM = 12
TILE_MAX_ZOOM = 18
COORDINATE_DECIMALS = 7


def require_tippecanoe() -> str:
    executable = shutil.which("tippecanoe")
    if executable is None:
        raise RuntimeError(
            "tippecanoe tidak ditemukan, pasang lewat: brew install tippecanoe"
        )
    return executable


def round_position(longitude: float, latitude: float) -> list[float]:
    return [round(longitude, COORDINATE_DECIMALS), round(latitude, COORDINATE_DECIMALS)]


def write_geojson_sequence(path: Path, features: list[dict[str, object]]) -> None:
    with path.open("w") as handle:
        for feature in features:
            handle.write(json.dumps(feature, separators=(",", ":")))
            handle.write("\n")


def build_alley_features(
    segments: list[AlleySegment], projection: MetricProjection
) -> list[dict[str, object]]:
    features: list[dict[str, object]] = []
    for segment in segments:
        coordinates = [
            round_position(*projection.to_degrees(easting, northing))
            for easting, northing in segment.metric_coordinates
        ]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "segmentId": segment.id,
                    "accessClass": segment.access_class,
                    "minWidthMeters": round(segment.min_width_meters, 2),
                    "meanWidthMeters": round(segment.mean_width_meters, 2),
                    "lengthMeters": round(segment.length_meters, 1),
                    "isNamedRoad": segment.is_named_road,
                },
                "geometry": {"type": "LineString", "coordinates": coordinates},
            }
        )
    return features


def build_building_features(
    records: list[BuildingRecord], projection: MetricProjection
) -> list[dict[str, object]]:
    features: list[dict[str, object]] = []
    for record in records:
        geographic = transform_geometry(
            lambda eastings, northings: projection.arrays_to_degrees(eastings, northings),
            record.polygon_metric,
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "buildingIndex": record.index,
                    "heightMeters": round(record.height_meters, 1),
                    "areaSquareMeters": round(record.area_square_meters, 1),
                    "materialClass": record.material_class,
                    "heightIsMeasured": record.height_is_measured,
                },
                "geometry": json.loads(shapely_to_geojson(geographic)),
            }
        )
    return features


def shapely_to_geojson(geometry: Polygon | MultiPolygon) -> str:
    from shapely.geometry import mapping

    mapped = mapping(geometry)
    return json.dumps(mapped, separators=(",", ":"))


def run_tippecanoe(
    source: Path,
    destination: Path,
    layer_name: str,
    id_attribute: str,
    kept_attributes: list[str],
) -> None:
    executable = require_tippecanoe()
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = [
        executable,
        "--force",
        "--output",
        str(destination),
        "--layer",
        layer_name,
        "--minimum-zoom",
        str(TILE_MIN_ZOOM),
        "--maximum-zoom",
        str(TILE_MAX_ZOOM),
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--no-line-simplification",
        "--preserve-input-order",
        "--use-attribute-for-id",
        id_attribute,
    ]
    if kept_attributes:
        for attribute in kept_attributes:
            command.extend(["--include", attribute])
    else:
        command.append("--exclude-all")
    command.append(str(source))
    subprocess.run(command, check=True, capture_output=True)
    announce("emit", f"{destination.name} {destination.stat().st_size // 1024} KB")


def emit_vector_tiles(
    segments: list[AlleySegment],
    records: list[BuildingRecord],
    projection: MetricProjection,
) -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    alley_source = WORK_DIR / "gangs.geojsonl"
    building_source = WORK_DIR / "buildings.geojsonl"

    write_geojson_sequence(alley_source, build_alley_features(segments, projection))
    write_geojson_sequence(building_source, build_building_features(records, projection))

    run_tippecanoe(alley_source, OUTPUT_DIR / "gangs.pmtiles", "gangs", "segmentId", ["accessClass"])
    run_tippecanoe(
        building_source, OUTPUT_DIR / "buildings.pmtiles", "buildings", "buildingIndex", []
    )
