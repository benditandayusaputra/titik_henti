from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import shapely
from shapely.strtree import STRtree

from common import announce
from derive.buildings import BuildingRecord


@dataclass
class AdjacencyTable:
    offsets: np.ndarray
    neighbour_indices: np.ndarray
    edge_distances_meters: np.ndarray

    @property
    def pair_count(self) -> int:
        return int(self.neighbour_indices.size)


def derive_building_adjacency(
    records: list[BuildingRecord], radius_meters: float
) -> AdjacencyTable:
    geometries = np.array([record.polygon_metric for record in records], dtype=object)
    tree = STRtree(list(geometries))
    search_areas = shapely.buffer(geometries, radius_meters)

    offsets = np.zeros(len(records) + 1, dtype=np.int32)
    neighbour_chunks: list[np.ndarray] = []
    distance_chunks: list[np.ndarray] = []
    running_total = 0

    for record in records:
        candidates = tree.query(search_areas[record.index])
        candidates = candidates[candidates != record.index]
        if candidates.size:
            distances = shapely.distance(
                geometries[record.index], geometries[candidates]
            ).astype(np.float32)
            inside = distances <= radius_meters
            candidates = candidates[inside]
            distances = distances[inside]
            order = np.argsort(distances, kind="stable")
            candidates = candidates[order].astype(np.uint32)
            distances = distances[order]
        else:
            candidates = np.empty(0, dtype=np.uint32)
            distances = np.empty(0, dtype=np.float32)

        neighbour_chunks.append(candidates)
        distance_chunks.append(distances)
        running_total += int(candidates.size)
        offsets[record.index + 1] = running_total

    neighbour_indices = (
        np.concatenate(neighbour_chunks) if neighbour_chunks else np.empty(0, dtype=np.uint32)
    )
    edge_distances = (
        np.concatenate(distance_chunks) if distance_chunks else np.empty(0, dtype=np.float32)
    )

    announce(
        "derive",
        f"pasangan ketetanggaan {int(neighbour_indices.size)} pada radius {radius_meters:.0f} m",
    )
    return AdjacencyTable(
        offsets=offsets,
        neighbour_indices=neighbour_indices.astype(np.uint32),
        edge_distances_meters=edge_distances.astype(np.float32),
    )
