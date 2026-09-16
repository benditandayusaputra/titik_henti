from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import transform as transform_geometry

from common import OUTPUT_DIR, Configuration, MetricProjection, announce, write_json
from derive.alleys import AlleySegment, summarise_length_by_class
from derive.buildings import BuildingRecord, summarise_material_mix
from derive.graph import AlleyGraph

ACCESS_CLASS_CODE = {"hoseOnly": 0, "smallUnit": 1, "largeUnit": 2}
PRINT_QUANTISATION_DEGREES = 1e-6
PRINT_SIMPLIFY_METERS = 1.2


def emit_graph_document(graph: AlleyGraph) -> None:
    payload: dict[str, Any] = {
        "nodeLon": [round(node.longitude, 7) for node in graph.nodes],
        "nodeLat": [round(node.latitude, 7) for node in graph.nodes],
        "edgeFrom": [edge.from_node_id for edge in graph.edges],
        "edgeTo": [edge.to_node_id for edge in graph.edges],
        "edgeLengthMeters": [round(edge.length_meters, 2) for edge in graph.edges],
        "edgeAccessClass": [ACCESS_CLASS_CODE[edge.access_class] for edge in graph.edges],
        "edgeMinWidthMeters": [round(edge.min_width_meters, 2) for edge in graph.edges],
        "edgeMeanWidthMeters": [round(edge.mean_width_meters, 2) for edge in graph.edges],
        "edgeSegmentId": [edge.segment_id for edge in graph.edges],
        "edgeIsNamedRoad": [1 if edge.is_named_road else 0 for edge in graph.edges],
        "waterSources": [
            {
                "id": source.id,
                "lon": round(source.longitude, 7),
                "lat": round(source.latitude, 7),
                "kind": source.kind,
                "label": source.label,
                "nearestNodeId": source.nearest_node_id,
                "nearestNodeDistanceMeters": round(source.nearest_node_distance_meters, 2),
            }
            for source in graph.water_sources
        ],
    }
    write_json(OUTPUT_DIR / "graph.json", payload)
    announce("emit", f"graph.json {(OUTPUT_DIR / 'graph.json').stat().st_size // 1024} KB")


def emit_print_document(
    records: list[BuildingRecord],
    segments: list[AlleySegment],
    projection: MetricProjection,
    boundary: Polygon | MultiPolygon,
    origin_longitude: float,
    origin_latitude: float,
) -> None:
    def quantise(longitude: float, latitude: float) -> tuple[int, int]:
        return (
            int(round((longitude - origin_longitude) / PRINT_QUANTISATION_DEGREES)),
            int(round((latitude - origin_latitude) / PRINT_QUANTISATION_DEGREES)),
        )

    building_rings: list[list[int]] = []
    for record in records:
        simplified = record.polygon_metric.simplify(PRINT_SIMPLIFY_METERS, preserve_topology=False)
        if simplified.is_empty:
            continue
        geographic = transform_geometry(
            lambda eastings, northings: projection.arrays_to_degrees(eastings, northings),
            simplified,
        )
        parts = geographic.geoms if isinstance(geographic, MultiPolygon) else [geographic]
        for part in parts:
            flattened: list[int] = []
            for longitude, latitude in part.exterior.coords:
                x, y = quantise(longitude, latitude)
                flattened.append(x)
                flattened.append(y)
            if len(flattened) >= 6:
                building_rings.append(flattened)

    alley_paths: list[dict[str, Any]] = []
    for segment in segments:
        flattened: list[int] = []
        for easting, northing in segment.metric_coordinates:
            longitude, latitude = projection.to_degrees(easting, northing)
            x, y = quantise(float(longitude), float(latitude))
            flattened.append(x)
            flattened.append(y)
        alley_paths.append(
            {
                "accessClass": segment.access_class,
                "points": flattened,
                "lengthMeters": round(segment.length_meters, 1),
            }
        )

    boundary_rings: list[list[int]] = []
    parts = boundary.geoms if isinstance(boundary, MultiPolygon) else [boundary]
    for part in parts:
        flattened = []
        for longitude, latitude in part.exterior.coords:
            x, y = quantise(longitude, latitude)
            flattened.append(x)
            flattened.append(y)
        boundary_rings.append(flattened)

    payload = {
        "originLon": origin_longitude,
        "originLat": origin_latitude,
        "quantisationDegrees": PRINT_QUANTISATION_DEGREES,
        "buildings": building_rings,
        "alleys": alley_paths,
        "boundary": boundary_rings,
    }
    write_json(OUTPUT_DIR / "print.json", payload)
    announce("emit", f"print.json {(OUTPUT_DIR / 'print.json').stat().st_size // 1024} KB")


def emit_meta_document(
    configuration: Configuration,
    records: list[BuildingRecord],
    segments: list[AlleySegment],
    graph: AlleyGraph,
    boundary_area_square_kilometres: float,
) -> dict[str, Any]:
    lengths = summarise_length_by_class(segments)
    total_length = sum(lengths.values()) or 1.0
    inaccessible_length = lengths["smallUnit"] + lengths["hoseOnly"]
    measured_heights = sum(1 for record in records if record.height_is_measured)

    payload: dict[str, Any] = {
        "pipelineVersion": configuration.pipeline_version,
        "processedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "villageName": configuration.village_name,
        "districtName": configuration.district_name,
        "cityName": configuration.city_name,
        "boundingBox": configuration.bounding_box.to_dict(),
        "areaSquareKilometres": round(boundary_area_square_kilometres, 4),
        "populationCount": configuration.population_count,
        "populationYear": configuration.population_year,
        "buildingCount": len(records),
        "alleySegmentCount": len(segments),
        "alleyNodeCount": len(graph.nodes),
        "alleyLengthMetersByClass": {
            "largeUnit": round(lengths["largeUnit"], 1),
            "smallUnit": round(lengths["smallUnit"], 1),
            "hoseOnly": round(lengths["hoseOnly"], 1),
        },
        "inaccessibleLengthShare": round(inaccessible_length / total_length, 4),
        "waterSourceCount": len(graph.water_sources),
        "rasterResolutionMeters": configuration.raster_resolution_meters,
        "materialMix": summarise_material_mix(records),
        "measuredHeightCount": measured_heights,
        "provenance": [
            {
                "label": "Tapak bangunan",
                "source": "Google Open Buildings V3 (polygons S2 level 6)",
                "licence": "CC BY 4.0",
                "retrievedAt": datetime.now(timezone.utc).date().isoformat(),
            },
            {
                "label": "Jaringan jalan dan gang",
                "source": "OpenStreetMap lewat Overpass API",
                "licence": "ODbL 1.0",
                "retrievedAt": datetime.now(timezone.utc).date().isoformat(),
            },
            {
                "label": "Sumber air",
                "source": "OpenStreetMap: emergency=fire_hydrant, man_made=water_well, natural=water",
                "licence": "ODbL 1.0",
                "retrievedAt": datetime.now(timezone.utc).date().isoformat(),
            },
            {
                "label": "Batas kelurahan",
                "source": f"OpenStreetMap relasi {configuration.boundary_relation_id}",
                "licence": "ODbL 1.0",
                "retrievedAt": datetime.now(timezone.utc).date().isoformat(),
            },
            {
                "label": "Jumlah penduduk",
                "source": configuration.population_source,
                "licence": "Publikasi BPS",
                "retrievedAt": str(configuration.population_year),
            },
        ],
        "estimatedFields": [
            "lebarGang: estimasi dari distance transform citra satelit, perlu verifikasi lapangan",
            "tinggiBangunan: terukur untuk bangunan bertag OSM, sisanya diperkirakan dari luas tapak",
            "kelasMaterial: diperkirakan dari luas dan tinggi, bukan hasil survei",
            "posisiUnitPemadam: titik henti kandidat pada segmen kelas unit besar, bukan hidran terpasang",
        ],
    }
    write_json(OUTPUT_DIR / "meta.json", payload)
    announce("emit", "meta.json ditulis")
    return payload
