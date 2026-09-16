from __future__ import annotations

import json
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pyproj import Transformer

PIPELINE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_ROOT.parent
RAW_DIR = PIPELINE_ROOT / "data" / "raw"
WORK_DIR = PIPELINE_ROOT / "data" / "work"
OUTPUT_DIR = PROJECT_ROOT / "static" / "data"
CONFIG_PATH = PIPELINE_ROOT / "config.json"

METERS_PER_DEGREE_LATITUDE = 110574.0


@dataclass(frozen=True)
class BoundingBox:
    west: float
    south: float
    east: float
    north: float

    def contains(self, lon: float, lat: float) -> bool:
        return self.west <= lon <= self.east and self.south <= lat <= self.north

    def center(self) -> tuple[float, float]:
        return ((self.west + self.east) / 2.0, (self.south + self.north) / 2.0)

    def expanded_by_meters(self, meters: float) -> "BoundingBox":
        _, center_latitude = self.center()
        latitude_padding = meters / METERS_PER_DEGREE_LATITUDE
        longitude_padding = meters / (
            METERS_PER_DEGREE_LATITUDE * max(math.cos(math.radians(center_latitude)), 0.2)
        )
        return BoundingBox(
            west=self.west - longitude_padding,
            south=self.south - latitude_padding,
            east=self.east + longitude_padding,
            north=self.north + latitude_padding,
        )

    def as_overpass_clause(self) -> str:
        return f"{self.south},{self.west},{self.north},{self.east}"

    def to_dict(self) -> dict[str, float]:
        return {"west": self.west, "south": self.south, "east": self.east, "north": self.north}


class Configuration:
    def __init__(self, values: dict[str, Any]) -> None:
        self._values = values
        box = values["boundingBox"]
        self.bounding_box = BoundingBox(box["west"], box["south"], box["east"], box["north"])

    def __getattr__(self, name: str) -> Any:
        camel = to_camel_case(name)
        if camel in self._values:
            return self._values[camel]
        raise AttributeError(name)

    def to_dict(self) -> dict[str, Any]:
        return dict(self._values)


def to_camel_case(snake: str) -> str:
    head, *rest = snake.split("_")
    return head + "".join(word.title() for word in rest)


def load_configuration() -> Configuration:
    return Configuration(json.loads(CONFIG_PATH.read_text()))


def ensure_directories() -> None:
    for directory in (RAW_DIR, WORK_DIR, OUTPUT_DIR):
        directory.mkdir(parents=True, exist_ok=True)


_stage_started_at = time.time()


def announce(stage: str, message: str) -> None:
    elapsed = time.time() - _stage_started_at
    sys.stdout.write(f"[{elapsed:7.1f}s] {stage:<10} {message}\n")
    sys.stdout.flush()


def pick_utm_epsg(longitude: float, latitude: float) -> int:
    zone = int((longitude + 180.0) // 6.0) + 1
    return 32600 + zone if latitude >= 0 else 32700 + zone


class MetricProjection:
    def __init__(self, longitude: float, latitude: float) -> None:
        self.epsg = pick_utm_epsg(longitude, latitude)
        self._forward = Transformer.from_crs(4326, self.epsg, always_xy=True)
        self._inverse = Transformer.from_crs(self.epsg, 4326, always_xy=True)

    def to_meters(self, longitude: float, latitude: float) -> tuple[float, float]:
        return self._forward.transform(longitude, latitude)

    def to_degrees(self, easting: float, northing: float) -> tuple[float, float]:
        return self._inverse.transform(easting, northing)

    def arrays_to_meters(self, longitudes: Any, latitudes: Any) -> tuple[Any, Any]:
        return self._forward.transform(longitudes, latitudes)

    def arrays_to_degrees(self, eastings: Any, northings: Any) -> tuple[Any, Any]:
        return self._inverse.transform(eastings, northings)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def format_thousands(value: int) -> str:
    return f"{value:,}".replace(",", ".")
