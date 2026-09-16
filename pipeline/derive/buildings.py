from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree
from shapely import wkt
from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.ops import transform as transform_geometry

from common import Configuration, MetricProjection, announce
from ingest.heights import (
    AREA_BUCKET_EDGES_SQUARE_METERS,
    FALLBACK_HEIGHT_METERS,
    MINIMUM_SAMPLES_FOR_REGRESSION,
    TaggedBuildingHeight,
)

MASONRY_MATERIAL_WORDS = ("brick", "concrete", "stone", "cement", "block")
LIGHTWEIGHT_MATERIAL_WORDS = ("wood", "timber", "metal", "plastic", "bamboo", "plaster")
LIGHTWEIGHT_MAX_AREA_SQUARE_METERS = 32.0
LIGHTWEIGHT_MAX_HEIGHT_METERS = 4.0
MASONRY_MIN_HEIGHT_METERS = 8.0
MASONRY_MIN_AREA_SQUARE_METERS = 150.0
TAG_SNAP_MAX_METERS = 4.0
TAG_SEARCH_RADIUS_METERS = 18.0

MATERIAL_CODE = {"masonry": 0, "mixed": 1, "lightweight": 2}


@dataclass
class BuildingRecord:
    index: int
    polygon_metric: Polygon
    centroid_easting: float
    centroid_northing: float
    longitude: float
    latitude: float
    area_square_meters: float
    height_meters: float
    height_is_measured: bool
    material_class: str


csv.field_size_limit(1 << 24)


def read_footprint_subset(path: Path) -> list[tuple[float, float, float, Polygon]]:
    rows: list[tuple[float, float, float, Polygon]] = []
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            geometry = wkt.loads(row["geometry"])
            if not isinstance(geometry, Polygon) or geometry.is_empty:
                continue
            rows.append(
                (
                    float(row["longitude"]),
                    float(row["latitude"]),
                    float(row["area_in_meters"]),
                    geometry,
                )
            )
    return rows


def project_polygon(polygon: Polygon, projection: MetricProjection) -> Polygon:
    return transform_geometry(
        lambda longitudes, latitudes: projection.arrays_to_meters(longitudes, latitudes),
        polygon,
    )


def fit_height_by_area_bucket(
    measured_areas: list[float], measured_heights: list[float]
) -> list[float]:
    bucket_totals = [0.0] * (len(AREA_BUCKET_EDGES_SQUARE_METERS) + 1)
    bucket_counts = [0] * (len(AREA_BUCKET_EDGES_SQUARE_METERS) + 1)
    for area, height in zip(measured_areas, measured_heights):
        bucket = pick_area_bucket(area)
        bucket_totals[bucket] += height
        bucket_counts[bucket] += 1

    overall = (
        sum(measured_heights) / len(measured_heights)
        if measured_heights
        else FALLBACK_HEIGHT_METERS
    )
    return [
        bucket_totals[index] / bucket_counts[index] if bucket_counts[index] >= 3 else overall
        for index in range(len(bucket_counts))
    ]


def pick_area_bucket(area_square_meters: float) -> int:
    for index, edge in enumerate(AREA_BUCKET_EDGES_SQUARE_METERS):
        if area_square_meters < edge:
            return index
    return len(AREA_BUCKET_EDGES_SQUARE_METERS)


def classify_material(
    area_square_meters: float, height_meters: float, tagged_material: str | None
) -> str:
    if tagged_material:
        lowered = tagged_material.lower()
        if any(word in lowered for word in MASONRY_MATERIAL_WORDS):
            return "masonry"
        if any(word in lowered for word in LIGHTWEIGHT_MATERIAL_WORDS):
            return "lightweight"
    if height_meters >= MASONRY_MIN_HEIGHT_METERS or area_square_meters >= MASONRY_MIN_AREA_SQUARE_METERS:
        return "masonry"
    if (
        area_square_meters < LIGHTWEIGHT_MAX_AREA_SQUARE_METERS
        and height_meters < LIGHTWEIGHT_MAX_HEIGHT_METERS
    ):
        return "lightweight"
    return "mixed"


def derive_building_table(
    configuration: Configuration,
    subset_csv: Path,
    projection: MetricProjection,
    study_area_metric: Polygon | MultiPolygon,
    tagged_heights: list[TaggedBuildingHeight],
) -> list[BuildingRecord]:
    raw_rows = read_footprint_subset(subset_csv)
    announce("derive", f"footprint terbaca {len(raw_rows)}")

    tagged_positions = np.array(
        [projection.to_meters(sample.longitude, sample.latitude) for sample in tagged_heights],
        dtype=np.float64,
    ) if tagged_heights else np.empty((0, 2), dtype=np.float64)
    tagged_tree = cKDTree(tagged_positions) if len(tagged_positions) else None

    records: list[BuildingRecord] = []
    measured_areas: list[float] = []
    measured_heights: list[float] = []
    pending: list[tuple[Polygon, float, float, float, float | None, str | None]] = []

    minimum_area = configuration.minimum_building_area_square_meters

    for longitude, latitude, area_square_meters, polygon in raw_rows:
        if area_square_meters < minimum_area:
            continue
        metric_polygon = project_polygon(polygon, projection)
        if metric_polygon.is_empty or not metric_polygon.is_valid:
            metric_polygon = metric_polygon.buffer(0)
        if metric_polygon.is_empty:
            continue
        centroid = metric_polygon.centroid
        if not study_area_metric.contains(centroid):
            continue

        measured_height: float | None = None
        tagged_material: str | None = None
        if tagged_tree is not None:
            candidate_indices = tagged_tree.query_ball_point((centroid.x, centroid.y), r=TAG_SEARCH_RADIUS_METERS)
            for candidate in candidate_indices:
                sample_point = Point(tagged_positions[candidate])
                if metric_polygon.contains(sample_point):
                    measured_height = tagged_heights[candidate].height_meters
                    tagged_material = tagged_heights[candidate].material
                    break
            if measured_height is None and candidate_indices:
                nearest = min(
                    candidate_indices,
                    key=lambda candidate: centroid.distance(Point(tagged_positions[candidate])),
                )
                if centroid.distance(Point(tagged_positions[nearest])) < TAG_SNAP_MAX_METERS:
                    measured_height = tagged_heights[nearest].height_meters
                    tagged_material = tagged_heights[nearest].material

        if measured_height is not None:
            measured_areas.append(area_square_meters)
            measured_heights.append(measured_height)

        pending.append(
            (metric_polygon, longitude, latitude, area_square_meters, measured_height, tagged_material)
        )

    bucket_heights = fit_height_by_area_bucket(measured_areas, measured_heights)
    use_regression = len(measured_heights) >= MINIMUM_SAMPLES_FOR_REGRESSION

    for metric_polygon, longitude, latitude, area_square_meters, measured_height, tagged_material in pending:
        if measured_height is not None:
            height_meters = measured_height
            height_is_measured = True
        elif use_regression:
            height_meters = bucket_heights[pick_area_bucket(area_square_meters)]
            height_is_measured = False
        else:
            height_meters = FALLBACK_HEIGHT_METERS
            height_is_measured = False

        centroid = metric_polygon.centroid
        records.append(
            BuildingRecord(
                index=len(records),
                polygon_metric=metric_polygon,
                centroid_easting=centroid.x,
                centroid_northing=centroid.y,
                longitude=longitude,
                latitude=latitude,
                area_square_meters=area_square_meters,
                height_meters=height_meters,
                height_is_measured=height_is_measured,
                material_class=classify_material(
                    area_square_meters, height_meters, tagged_material
                ),
            )
        )

    measured_share = sum(1 for record in records if record.height_is_measured)
    announce(
        "derive",
        f"bangunan dalam batas {len(records)}, tinggi terukur {measured_share}",
    )
    return records


def summarise_material_mix(records: list[BuildingRecord]) -> dict[str, int]:
    mix: dict[str, int] = {"masonry": 0, "mixed": 0, "lightweight": 0}
    for record in records:
        mix[record.material_class] += 1
    return mix
