from __future__ import annotations

import csv
import gzip
import sys
from pathlib import Path

import requests

from common import RAW_DIR, BoundingBox, Configuration, announce

OPEN_BUILDINGS_BASE_URL = (
    "https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_6_gzip_no_header"
)
DOWNLOAD_CHUNK_BYTES = 1 << 22
PROGRESS_ROW_INTERVAL = 4_000_000


def cell_archive_path(cell_token: str) -> Path:
    return RAW_DIR / f"open_buildings_v3_{cell_token}.csv.gz"


def subset_path() -> Path:
    return RAW_DIR / "open_buildings_subset.csv"


def download_open_buildings_cell(cell_token: str) -> Path:
    target = cell_archive_path(cell_token)
    url = f"{OPEN_BUILDINGS_BASE_URL}/{cell_token}_buildings.csv.gz"
    head = requests.head(url, timeout=60, allow_redirects=True)
    head.raise_for_status()
    expected_bytes = int(head.headers.get("Content-Length", "0"))

    if target.exists() and target.stat().st_size == expected_bytes:
        announce("ingest", f"arsip open buildings {cell_token} sudah lengkap")
        return target

    resume_from = target.stat().st_size if target.exists() else 0
    headers = {"Range": f"bytes={resume_from}-"} if resume_from else {}
    announce("ingest", f"mengunduh open buildings {cell_token} dari byte {resume_from}")

    with requests.get(url, stream=True, timeout=120, headers=headers) as response:
        response.raise_for_status()
        mode = "ab" if resume_from else "wb"
        written = resume_from
        with target.open(mode) as handle:
            for chunk in response.iter_content(DOWNLOAD_CHUNK_BYTES):
                handle.write(chunk)
                written += len(chunk)
                if expected_bytes:
                    share = 100.0 * written / expected_bytes
                    sys.stdout.write(f"\r          unduh {share:5.1f}%")
                    sys.stdout.flush()
    sys.stdout.write("\n")
    return target


def extract_buildings_inside(
    archive: Path, box: BoundingBox, confidence_minimum: float, destination: Path
) -> int:
    kept = 0
    scanned = 0
    with gzip.open(archive, "rt", newline="") as source, destination.open(
        "w", newline=""
    ) as sink:
        writer = csv.writer(sink)
        writer.writerow(["latitude", "longitude", "area_in_meters", "confidence", "geometry"])
        for line in source:
            scanned += 1
            if scanned % PROGRESS_ROW_INTERVAL == 0:
                sys.stdout.write(f"\r          pindai {scanned // 1_000_000} juta baris")
                sys.stdout.flush()
            first_comma = line.find(",")
            if first_comma < 0:
                continue
            latitude = float(line[:first_comma])
            if latitude < box.south or latitude > box.north:
                continue
            second_comma = line.find(",", first_comma + 1)
            longitude = float(line[first_comma + 1 : second_comma])
            if longitude < box.west or longitude > box.east:
                continue
            third_comma = line.find(",", second_comma + 1)
            fourth_comma = line.find(",", third_comma + 1)
            confidence = float(line[third_comma + 1 : fourth_comma])
            if confidence < confidence_minimum:
                continue
            geometry = line[fourth_comma + 1 :].strip()
            if geometry.startswith('"'):
                geometry = geometry[1:]
            closing_quote = geometry.rfind('"')
            if closing_quote >= 0:
                geometry = geometry[:closing_quote]
            writer.writerow(
                [
                    line[:first_comma],
                    line[first_comma + 1 : second_comma],
                    line[second_comma + 1 : third_comma],
                    line[third_comma + 1 : fourth_comma],
                    geometry,
                ]
            )
            kept += 1
    sys.stdout.write("\n")
    return kept


def ingest_building_footprints(configuration: Configuration) -> Path:
    destination = subset_path()
    if destination.exists() and destination.stat().st_size > 0:
        announce("ingest", "memakai cache subset footprint bangunan")
        return destination

    archive = download_open_buildings_cell(configuration.open_buildings_cell_token)
    analysis_box = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    kept = extract_buildings_inside(
        archive,
        analysis_box,
        configuration.open_buildings_confidence_minimum,
        destination,
    )
    announce("ingest", f"footprint bangunan terpilih {kept}")
    return destination
