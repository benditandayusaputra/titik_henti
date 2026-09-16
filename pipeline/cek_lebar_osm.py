from __future__ import annotations

import json
import math
import statistics
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (
    PROJECT_ROOT,
    WORK_DIR,
    MetricProjection,
    announce,
    load_configuration,
    write_json,
)

OUTPUT_PATH = PROJECT_ROOT / "src" / "lib" / "domain" / "osm-width-check.json"
NARROW_WAY_PATTERN = "^(residential|living_street|service|footway|path|pedestrian|track)$"
SAMPLE_SPACING_METERS = 4.0
PRIMARY_MATCH_DISTANCE_METERS = 6.0
PRIMARY_MATCH_CONSISTENCY = 0.7
SENSITIVITY_DISTANCES_METERS = (3.0, 4.0, 6.0, 8.0)
SENSITIVITY_CONSISTENCIES = (0.6, 0.7, 0.8, 0.9)
REQUEST_TIMEOUT_SECONDS = 240
ATTEMPTS = 3


@dataclass(frozen=True)
class TaggedWay:
    width_meters: float
    points_metric: list[tuple[float, float]]


@dataclass(frozen=True)
class MatchedWay:
    osm_width_meters: float
    pipeline_min_width_meters: float
    median_distance_meters: float


def build_query(configuration) -> str:
    box = configuration.bounding_box
    clause = f"{box.south},{box.west},{box.north},{box.east}"
    return (
        "[out:json][timeout:180];"
        f'(way["highway"~"{NARROW_WAY_PATTERN}"]["width"]({clause}););'
        "out geom;"
    )


def fetch_tagged_ways(configuration, projection: MetricProjection) -> list[TaggedWay]:
    query = build_query(configuration)
    failures: list[str] = []
    for attempt in range(ATTEMPTS):
        endpoint = configuration.overpass_endpoints[attempt % len(configuration.overpass_endpoints)]
        try:
            response = requests.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": "titik-henti-pipeline/1.0"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            elements = response.json().get("elements", [])
            break
        except Exception as failure:
            failures.append(f"{endpoint}: {failure}")
            time.sleep(6)
    else:
        raise RuntimeError("overpass gagal\n" + "\n".join(failures))

    ways: list[TaggedWay] = []
    for element in elements:
        try:
            width = float(element["tags"]["width"])
        except (KeyError, ValueError):
            continue
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        points = [projection.to_meters(node["lon"], node["lat"]) for node in geometry]
        ways.append(TaggedWay(width_meters=width, points_metric=points))
    return ways


def sample_along(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    samples: list[tuple[float, float]] = []
    for start, end in zip(points, points[1:]):
        length = math.dist(start, end)
        steps = max(1, int(length // SAMPLE_SPACING_METERS))
        for step in range(steps):
            fraction = step / steps
            samples.append(
                (
                    start[0] + (end[0] - start[0]) * fraction,
                    start[1] + (end[1] - start[1]) * fraction,
                )
            )
    return samples


def load_pipeline_segments(projection: MetricProjection):
    widths: list[float] = []
    vertices: list[tuple[float, float]] = []
    owners: list[int] = []
    with (WORK_DIR / "gangs.geojsonl").open() as handle:
        for line in handle:
            feature = json.loads(line)
            index = len(widths)
            widths.append(feature["properties"]["minWidthMeters"])
            for lon, lat in feature["geometry"]["coordinates"]:
                vertices.append(projection.to_meters(lon, lat))
                owners.append(index)
    return widths, cKDTree(np.array(vertices)), np.array(owners)


def match_ways(ways, widths, tree, owners, distance_limit, consistency) -> list[MatchedWay]:
    matched: list[MatchedWay] = []
    for way in ways:
        samples = sample_along(way.points_metric)
        if not samples:
            continue
        distances, indices = tree.query(np.array(samples), k=1)
        near = distances <= distance_limit
        if near.sum() / len(samples) < consistency:
            continue
        values, counts = np.unique(owners[indices[near]], return_counts=True)
        if counts.max() / near.sum() < consistency:
            continue
        matched.append(
            MatchedWay(
                osm_width_meters=way.width_meters,
                pipeline_min_width_meters=widths[int(values[counts.argmax()])],
                median_distance_meters=float(np.median(distances[near])),
            )
        )
    return matched


def summarise(matched: list[MatchedWay]) -> dict[str, float | int]:
    differences = [way.pipeline_min_width_meters - way.osm_width_meters for way in matched]
    return {
        "matchedWayCount": len(differences),
        "medianDifferenceMeters": round(statistics.median(differences), 2),
        "lowerQuartileDifferenceMeters": round(float(np.percentile(differences, 25)), 2),
        "upperQuartileDifferenceMeters": round(float(np.percentile(differences, 75)), 2),
        "pipelineWiderShare": round(sum(1 for value in differences if value > 0) / len(differences), 3),
        "withinHalfMeterCount": sum(1 for value in differences if abs(value) <= 0.5),
        "withinOneMeterCount": sum(1 for value in differences if abs(value) <= 1.0),
    }


def run_check() -> None:
    configuration = load_configuration()
    center_longitude, center_latitude = configuration.bounding_box.center()
    projection = MetricProjection(center_longitude, center_latitude)

    ways = fetch_tagged_ways(configuration, projection)
    announce("cek", f"ruas OSM bertag lebar {len(ways)}")

    widths, tree, owners = load_pipeline_segments(projection)
    announce("cek", f"segmen pipeline {len(widths)}")

    primary = match_ways(
        ways, widths, tree, owners, PRIMARY_MATCH_DISTANCE_METERS, PRIMARY_MATCH_CONSISTENCY
    )
    if not primary:
        raise RuntimeError("tidak ada ruas OSM yang dapat dicocokkan")

    sensitivity = []
    for distance in SENSITIVITY_DISTANCES_METERS:
        for consistency in SENSITIVITY_CONSISTENCIES:
            matched = match_ways(ways, widths, tree, owners, distance, consistency)
            if matched:
                sensitivity.append(
                    {"maxDistanceMeters": distance, "minConsistency": consistency, **summarise(matched)}
                )

    medians = [row["medianDifferenceMeters"] for row in sensitivity]
    wider_shares = [row["pipelineWiderShare"] for row in sensitivity]

    payload = {
        "villageName": configuration.village_name,
        "checkedAt": datetime.now(timezone.utc).date().isoformat(),
        "taggedWayCount": len(ways),
        "sampleSpacingMeters": SAMPLE_SPACING_METERS,
        "primary": {
            "maxDistanceMeters": PRIMARY_MATCH_DISTANCE_METERS,
            "minConsistency": PRIMARY_MATCH_CONSISTENCY,
            **summarise(primary),
        },
        "sensitivityConfigurationCount": len(sensitivity),
        "sensitivityMedianRangeMeters": [min(medians), max(medians)],
        "sensitivityWiderShareRange": [min(wider_shares), max(wider_shares)],
    }
    write_json(OUTPUT_PATH, payload)
    announce(
        "cek",
        f"median selisih {payload['primary']['medianDifferenceMeters']} m pada "
        f"{payload['primary']['matchedWayCount']} ruas, ditulis ke {OUTPUT_PATH.name}",
    )


if __name__ == "__main__":
    run_check()
