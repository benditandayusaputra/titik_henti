from __future__ import annotations

import struct
from pathlib import Path

import numpy as np

from common import OUTPUT_DIR, announce
from derive.adjacency import AdjacencyTable
from derive.buildings import MATERIAL_CODE, BuildingRecord

ADJACENCY_MAGIC = 0x4A414854
BUILDING_MAGIC = 0x4C424854
BINARY_FORMAT_VERSION = 1


def emit_adjacency_binary(table: AdjacencyTable) -> Path:
    destination = OUTPUT_DIR / "adjacency.bin"
    building_count = int(table.offsets.size - 1)
    pair_count = table.pair_count

    header = struct.pack(
        "<IIII", ADJACENCY_MAGIC, BINARY_FORMAT_VERSION, building_count, pair_count
    )
    interleaved = np.empty(pair_count * 2, dtype=np.uint32)
    interleaved[0::2] = table.neighbour_indices.astype(np.uint32)
    interleaved[1::2] = table.edge_distances_meters.astype(np.float32).view(np.uint32)

    with destination.open("wb") as handle:
        handle.write(header)
        handle.write(table.offsets.astype(np.int32).tobytes())
        handle.write(interleaved.tobytes())

    announce("emit", f"adjacency.bin {destination.stat().st_size // 1024} KB")
    return destination


def emit_building_binary(
    records: list[BuildingRecord],
    nearest_node_ids: np.ndarray,
    nearest_node_distances: np.ndarray,
) -> Path:
    destination = OUTPUT_DIR / "buildings.bin"
    count = len(records)

    longitudes = np.array([record.longitude for record in records], dtype=np.float64)
    latitudes = np.array([record.latitude for record in records], dtype=np.float64)
    areas = np.array([record.area_square_meters for record in records], dtype=np.float32)
    heights = np.array([record.height_meters for record in records], dtype=np.float32)
    materials = np.array(
        [MATERIAL_CODE[record.material_class] for record in records], dtype=np.uint8
    )
    measured = np.array(
        [1 if record.height_is_measured else 0 for record in records], dtype=np.uint8
    )

    padding_length = (-count) % 4
    padding = np.zeros(padding_length, dtype=np.uint8)

    with destination.open("wb") as handle:
        handle.write(struct.pack("<IIII", BUILDING_MAGIC, BINARY_FORMAT_VERSION, count, 0))
        handle.write(longitudes.tobytes())
        handle.write(latitudes.tobytes())
        handle.write(areas.tobytes())
        handle.write(heights.tobytes())
        handle.write(nearest_node_ids.astype(np.int32).tobytes())
        handle.write(nearest_node_distances.astype(np.float32).tobytes())
        handle.write(materials.tobytes())
        handle.write(padding.tobytes())
        handle.write(measured.tobytes())
        handle.write(padding.tobytes())

    announce("emit", f"buildings.bin {destination.stat().st_size // 1024} KB")
    return destination
