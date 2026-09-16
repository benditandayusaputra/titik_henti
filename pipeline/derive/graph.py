from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Point

from common import Configuration, MetricProjection, announce
from derive.alleys import AlleySegment
from derive.buildings import BuildingRecord
from ingest.water import RawWaterSource

NODE_SNAP_GRID_METERS = 0.05
WATER_SNAP_MAX_METERS = 45.0
NEAREST_NODE_CANDIDATE_COUNT = 10


@dataclass
class GraphNode:
    id: int
    easting: float
    northing: float
    longitude: float
    latitude: float


@dataclass
class GraphEdge:
    id: int
    segment_id: int
    from_node_id: int
    to_node_id: int
    length_meters: float
    min_width_meters: float
    mean_width_meters: float
    access_class: str
    is_named_road: bool


@dataclass
class ResolvedWaterSource:
    id: int
    longitude: float
    latitude: float
    kind: str
    label: str
    nearest_node_id: int
    nearest_node_distance_meters: float


@dataclass
class AlleyGraph:
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    water_sources: list[ResolvedWaterSource]


def densify_polyline(
    coordinates: list[tuple[float, float]], spacing_meters: float
) -> list[tuple[float, float]]:
    densified: list[tuple[float, float]] = [coordinates[0]]
    for index in range(1, len(coordinates)):
        start_easting, start_northing = coordinates[index - 1]
        end_easting, end_northing = coordinates[index]
        span = float(np.hypot(end_easting - start_easting, end_northing - start_northing))
        steps = max(1, int(np.ceil(span / spacing_meters)))
        for step in range(1, steps + 1):
            ratio = step / steps
            densified.append(
                (
                    start_easting + (end_easting - start_easting) * ratio,
                    start_northing + (end_northing - start_northing) * ratio,
                )
            )
    return densified


def build_alley_graph(
    configuration: Configuration,
    segments: list[AlleySegment],
    projection: MetricProjection,
) -> AlleyGraph:
    spacing = configuration.graph_node_spacing_meters
    node_ids_by_key: dict[tuple[int, int], int] = {}
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    def resolve_node(easting: float, northing: float) -> int:
        key = (
            int(round(easting / NODE_SNAP_GRID_METERS)),
            int(round(northing / NODE_SNAP_GRID_METERS)),
        )
        existing = node_ids_by_key.get(key)
        if existing is not None:
            return existing
        longitude, latitude = projection.to_degrees(easting, northing)
        node = GraphNode(
            id=len(nodes),
            easting=easting,
            northing=northing,
            longitude=float(longitude),
            latitude=float(latitude),
        )
        nodes.append(node)
        node_ids_by_key[key] = node.id
        return node.id

    for segment in segments:
        densified = densify_polyline(segment.metric_coordinates, spacing)
        previous_id = resolve_node(*densified[0])
        for point in densified[1:]:
            current_id = resolve_node(*point)
            if current_id == previous_id:
                continue
            start = nodes[previous_id]
            end = nodes[current_id]
            length = float(
                np.hypot(end.easting - start.easting, end.northing - start.northing)
            )
            edges.append(
                GraphEdge(
                    id=len(edges),
                    segment_id=segment.id,
                    from_node_id=previous_id,
                    to_node_id=current_id,
                    length_meters=length,
                    min_width_meters=segment.min_width_meters,
                    mean_width_meters=segment.mean_width_meters,
                    access_class=segment.access_class,
                    is_named_road=segment.is_named_road,
                )
            )
            previous_id = current_id

    announce("derive", f"graf jaringan {len(nodes)} node, {len(edges)} sisi")
    return AlleyGraph(nodes=nodes, edges=edges, water_sources=[])


def build_node_tree(graph: AlleyGraph) -> cKDTree:
    return cKDTree(
        np.array([(node.easting, node.northing) for node in graph.nodes], dtype=np.float64)
    )


def attach_buildings_to_graph(
    graph: AlleyGraph,
    node_tree: cKDTree,
    buildings: list[BuildingRecord],
    maximum_distance_meters: float,
) -> tuple[np.ndarray, np.ndarray]:
    nearest_node = np.full(len(buildings), -1, dtype=np.int32)
    nearest_distance = np.zeros(len(buildings), dtype=np.float32)

    for building in buildings:
        distances, indices = node_tree.query(
            (building.centroid_easting, building.centroid_northing),
            k=min(NEAREST_NODE_CANDIDATE_COUNT, len(graph.nodes)),
        )
        candidate_indices = np.atleast_1d(indices)
        best_index = -1
        best_distance = float("inf")
        for candidate in candidate_indices:
            node = graph.nodes[int(candidate)]
            distance = building.polygon_metric.distance(Point(node.easting, node.northing))
            if distance < best_distance:
                best_distance = distance
                best_index = int(candidate)
        if best_index >= 0 and best_distance <= maximum_distance_meters:
            nearest_node[building.index] = best_index
            nearest_distance[building.index] = best_distance
        else:
            nearest_distance[building.index] = float(np.atleast_1d(distances)[0])

    connected = int((nearest_node >= 0).sum())
    announce("derive", f"bangunan tersambung ke jaringan {connected}/{len(buildings)}")
    return nearest_node, nearest_distance


def collect_appliance_stand_nodes(
    graph: AlleyGraph, spacing_meters: float
) -> list[int]:
    large_unit_nodes: list[int] = []
    seen: set[int] = set()
    for edge in graph.edges:
        if edge.access_class != "largeUnit":
            continue
        for node_id in (edge.from_node_id, edge.to_node_id):
            if node_id not in seen:
                seen.add(node_id)
                large_unit_nodes.append(node_id)
    if not large_unit_nodes:
        return []

    chosen: list[int] = []
    chosen_positions: list[tuple[float, float]] = []
    for node_id in large_unit_nodes:
        node = graph.nodes[node_id]
        position = (node.easting, node.northing)
        if all(
            float(np.hypot(position[0] - other[0], position[1] - other[1])) >= spacing_meters
            for other in chosen_positions
        ):
            chosen.append(node_id)
            chosen_positions.append(position)
    return chosen


def attach_water_sources(
    configuration: Configuration,
    graph: AlleyGraph,
    node_tree: cKDTree,
    raw_sources: list[RawWaterSource],
    projection: MetricProjection,
) -> list[ResolvedWaterSource]:
    resolved: list[ResolvedWaterSource] = []

    for source in raw_sources:
        easting, northing = projection.to_meters(source.longitude, source.latitude)
        distance, index = node_tree.query((easting, northing))
        if float(distance) > WATER_SNAP_MAX_METERS:
            continue
        resolved.append(
            ResolvedWaterSource(
                id=len(resolved),
                longitude=source.longitude,
                latitude=source.latitude,
                kind=source.kind,
                label=source.label,
                nearest_node_id=int(index),
                nearest_node_distance_meters=float(distance),
            )
        )

    stand_nodes = collect_appliance_stand_nodes(
        graph, configuration.appliance_stand_spacing_meters
    )
    for node_id in stand_nodes:
        node = graph.nodes[node_id]
        resolved.append(
            ResolvedWaterSource(
                id=len(resolved),
                longitude=node.longitude,
                latitude=node.latitude,
                kind="applianceStand",
                label="Posisi unit pemadam",
                nearest_node_id=node_id,
                nearest_node_distance_meters=0.0,
            )
        )

    announce(
        "derive",
        f"sumber air terpakai {len(resolved)}, di antaranya {len(stand_nodes)} posisi unit",
    )
    return resolved
