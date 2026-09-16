from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import transform as transform_geometry

from common import (
    Configuration,
    MetricProjection,
    announce,
    ensure_directories,
    format_thousands,
    load_configuration,
)
from derive.adjacency import derive_building_adjacency
from derive.alleys import build_named_road_area, derive_alley_segments
from derive.buildings import derive_building_table, read_footprint_subset
from derive.graph import (
    attach_buildings_to_graph,
    attach_water_sources,
    build_alley_graph,
    build_node_tree,
)
from emit.binaries import emit_adjacency_binary, emit_building_binary
from emit.documents import emit_graph_document, emit_meta_document, emit_print_document
from emit.tiles import emit_vector_tiles
from ingest.boundary import ingest_village_boundary
from ingest.buildings import ingest_building_footprints
from ingest.heights import ingest_tagged_building_heights
from ingest.roads import ingest_road_network
from ingest.water import (
    ingest_water_obstacles,
    ingest_water_sources,
    read_waterway_width_meters,
)

STUDY_AREA_BUFFER_METERS = 25.0
SKELETON_MASK_BUFFER_METERS = 120.0
SQUARE_METERS_PER_SQUARE_KILOMETER = 1_000_000.0


def project_geometry(geometry, projection: MetricProjection):
    return transform_geometry(
        lambda longitudes, latitudes: projection.arrays_to_meters(longitudes, latitudes),
        geometry,
    )


def build_obstacle_polygons(
    configuration: Configuration,
    projection: MetricProjection,
    water_obstacles: list[LineString | Polygon],
) -> list[Polygon | MultiPolygon]:
    subset_rows = read_footprint_subset(
        Path(__file__).resolve().parent / "data" / "raw" / "open_buildings_subset.csv"
    )
    minimum_area = configuration.minimum_building_area_square_meters
    polygons: list[Polygon | MultiPolygon] = []
    for _, _, area_square_meters, polygon in subset_rows:
        if area_square_meters < minimum_area:
            continue
        metric = project_geometry(polygon, projection)
        if not metric.is_valid:
            metric = metric.buffer(0)
        if not metric.is_empty:
            polygons.append(metric)

    for obstacle in water_obstacles:
        metric = project_geometry(obstacle, projection)
        if isinstance(metric, LineString):
            metric = metric.buffer(read_waterway_width_meters({}) / 2.0)
        if not metric.is_valid:
            metric = metric.buffer(0)
        if not metric.is_empty:
            polygons.append(metric)

    announce("derive", f"poligon penghalang raster {len(polygons)}")
    return polygons


def run_pipeline() -> None:
    configuration = load_configuration()
    ensure_directories()

    center_longitude, center_latitude = configuration.bounding_box.center()
    projection = MetricProjection(center_longitude, center_latitude)
    announce("mulai", f"proyeksi metrik EPSG:{projection.epsg}")

    subset_csv = ingest_building_footprints(configuration)
    boundary_geographic = ingest_village_boundary(configuration)
    road_lines = ingest_road_network(configuration)
    water_sources_raw = ingest_water_sources(configuration)
    water_obstacles = ingest_water_obstacles(configuration)
    tagged_heights = ingest_tagged_building_heights(configuration)

    boundary_metric = project_geometry(boundary_geographic, projection)
    study_area_metric = boundary_metric.buffer(STUDY_AREA_BUFFER_METERS)
    skeleton_mask_metric = boundary_metric.buffer(SKELETON_MASK_BUFFER_METERS)

    limits = configuration.bounding_box.expanded_by_meters(
        configuration.analysis_buffer_meters
    )
    raster_area_metric = project_geometry(
        box(limits.west, limits.south, limits.east, limits.north), projection
    )

    building_records = derive_building_table(
        configuration, subset_csv, projection, study_area_metric, tagged_heights
    )
    obstacle_polygons = build_obstacle_polygons(configuration, projection, water_obstacles)

    named_road_metric = [
        project_geometry(LineString(road.coordinates), projection)
        for road in road_lines
        if road.is_named_vehicle_road and len(road.coordinates) >= 2
    ]
    named_road_area = build_named_road_area(
        named_road_metric, configuration.named_road_match_buffer_meters
    )

    segments, _ = derive_alley_segments(
        configuration,
        obstacle_polygons,
        raster_area_metric,
        skeleton_mask_metric,
        study_area_metric,
        named_road_area,
    )

    adjacency = derive_building_adjacency(
        building_records, configuration.adjacency_radius_meters
    )

    graph = build_alley_graph(configuration, segments, projection)
    node_tree = build_node_tree(graph)
    nearest_node_ids, nearest_node_distances = attach_buildings_to_graph(
        graph, node_tree, building_records, configuration.building_connection_max_meters
    )
    graph.water_sources = attach_water_sources(
        configuration, graph, node_tree, water_sources_raw, projection
    )

    emit_vector_tiles(segments, building_records, projection)
    emit_adjacency_binary(adjacency)
    emit_building_binary(building_records, nearest_node_ids, nearest_node_distances)
    emit_graph_document(graph)
    emit_print_document(
        building_records,
        segments,
        projection,
        boundary_geographic,
        configuration.bounding_box.west,
        configuration.bounding_box.south,
    )
    meta = emit_meta_document(
        configuration,
        building_records,
        segments,
        graph,
        boundary_metric.area / SQUARE_METERS_PER_SQUARE_KILOMETER,
    )

    announce("selesai", f"bangunan {format_thousands(meta['buildingCount'])}")
    announce("selesai", f"segmen gang {format_thousands(meta['alleySegmentCount'])}")
    announce(
        "selesai",
        "panjang gang meter "
        + ", ".join(
            f"{name} {round(value)}"
            for name, value in meta["alleyLengthMetersByClass"].items()
        ),
    )
    announce(
        "selesai",
        f"pangsa panjang tak terlalui kendaraan {meta['inaccessibleLengthShare'] * 100:.1f} persen",
    )


if __name__ == "__main__":
    run_pipeline()
