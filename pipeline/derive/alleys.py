from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_closing, distance_transform_edt, median_filter
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union
from skimage.morphology import disk, skeletonize

from common import Configuration, announce

ORTHOGONAL_OFFSETS = ((-1, 0), (1, 0), (0, -1), (0, 1))
DIAGONAL_OFFSETS = ((-1, -1), (-1, 1), (1, -1), (1, 1))
MAX_PRUNE_PASSES = 8
MAX_REPORTED_WIDTH_METERS = 40.0

Pixel = tuple[int, int]


@dataclass
class RasterFrame:
    origin_easting: float
    top_northing: float
    resolution_meters: float
    column_count: int
    row_count: int

    def to_pixel(self, easting: float, northing: float) -> tuple[float, float]:
        return (
            (easting - self.origin_easting) / self.resolution_meters,
            (self.top_northing - northing) / self.resolution_meters,
        )

    def to_metric(self, row: int, column: int) -> tuple[float, float]:
        return (
            self.origin_easting + (column + 0.5) * self.resolution_meters,
            self.top_northing - (row + 0.5) * self.resolution_meters,
        )


@dataclass
class AlleySegment:
    id: int
    pixel_path: list[Pixel]
    metric_coordinates: list[tuple[float, float]]
    length_meters: float
    min_width_meters: float
    mean_width_meters: float
    access_class: str
    is_named_road: bool = False
    node_pixels: tuple[Pixel, Pixel] = field(default=((0, 0), (0, 0)))


def build_raster_frame(
    area: Polygon | MultiPolygon, resolution_meters: float
) -> RasterFrame:
    min_easting, min_northing, max_easting, max_northing = area.bounds
    column_count = int(np.ceil((max_easting - min_easting) / resolution_meters)) + 2
    row_count = int(np.ceil((max_northing - min_northing) / resolution_meters)) + 2
    return RasterFrame(
        origin_easting=min_easting - resolution_meters,
        top_northing=max_northing + resolution_meters,
        resolution_meters=resolution_meters,
        column_count=column_count,
        row_count=row_count,
    )


def rasterize_polygons(
    frame: RasterFrame, polygons: list[Polygon | MultiPolygon]
) -> np.ndarray:
    image = Image.new("1", (frame.column_count, frame.row_count), 0)
    painter = ImageDraw.Draw(image)
    for geometry in polygons:
        parts = geometry.geoms if isinstance(geometry, MultiPolygon) else [geometry]
        for part in parts:
            exterior = [frame.to_pixel(x, y) for x, y in part.exterior.coords]
            if len(exterior) >= 3:
                painter.polygon(exterior, fill=1)
            for interior in part.interiors:
                hole = [frame.to_pixel(x, y) for x, y in interior.coords]
                if len(hole) >= 3:
                    painter.polygon(hole, fill=0)
    return np.array(image, dtype=bool)


def collect_neighbours(pixel: Pixel, membership: set[Pixel]) -> list[Pixel]:
    row, column = pixel
    neighbours: list[Pixel] = []
    for row_step, column_step in ORTHOGONAL_OFFSETS:
        candidate = (row + row_step, column + column_step)
        if candidate in membership:
            neighbours.append(candidate)
    for row_step, column_step in DIAGONAL_OFFSETS:
        candidate = (row + row_step, column + column_step)
        if candidate not in membership:
            continue
        if (row + row_step, column) in membership or (row, column + column_step) in membership:
            continue
        neighbours.append(candidate)
    return neighbours


def trace_skeleton_paths(skeleton: np.ndarray) -> list[list[Pixel]]:
    membership: set[Pixel] = {
        (int(row), int(column)) for row, column in np.argwhere(skeleton)
    }
    neighbour_cache: dict[Pixel, list[Pixel]] = {
        pixel: collect_neighbours(pixel, membership) for pixel in membership
    }
    node_pixels = {
        pixel for pixel, neighbours in neighbour_cache.items() if len(neighbours) != 2
    }

    used_steps: set[tuple[Pixel, Pixel]] = set()
    paths: list[list[Pixel]] = []

    def walk_from(start: Pixel, first: Pixel) -> list[Pixel]:
        path = [start, first]
        used_steps.add((start, first))
        used_steps.add((first, start))
        previous, current = start, first
        while current not in node_pixels:
            forward = [
                candidate
                for candidate in neighbour_cache[current]
                if candidate != previous and (current, candidate) not in used_steps
            ]
            if not forward:
                break
            following = forward[0]
            used_steps.add((current, following))
            used_steps.add((following, current))
            path.append(following)
            previous, current = current, following
        return path

    for pixel in node_pixels:
        for neighbour in neighbour_cache[pixel]:
            if (pixel, neighbour) in used_steps:
                continue
            paths.append(walk_from(pixel, neighbour))

    for pixel in membership:
        for neighbour in neighbour_cache[pixel]:
            if (pixel, neighbour) in used_steps:
                continue
            paths.append(walk_from(pixel, neighbour))

    return [path for path in paths if len(path) >= 2]


def measure_pixel_path_meters(path: list[Pixel], resolution_meters: float) -> float:
    total = 0.0
    for index in range(1, len(path)):
        row_step = path[index][0] - path[index - 1][0]
        column_step = path[index][1] - path[index - 1][1]
        total += resolution_meters * float(np.hypot(row_step, column_step))
    return total


def count_incidences(paths: list[list[Pixel]]) -> dict[Pixel, int]:
    incidences: dict[Pixel, int] = {}
    for path in paths:
        for endpoint in (path[0], path[-1]):
            incidences[endpoint] = incidences.get(endpoint, 0) + 1
    return incidences


def prune_short_spurs(
    paths: list[list[Pixel]], resolution_meters: float, prune_length_meters: float
) -> list[list[Pixel]]:
    surviving = paths
    for _ in range(MAX_PRUNE_PASSES):
        incidences = count_incidences(surviving)
        removed = 0
        kept: list[list[Pixel]] = []
        for path in surviving:
            head, tail = path[0], path[-1]
            length = measure_pixel_path_meters(path, resolution_meters)
            head_degree = incidences.get(head, 0)
            tail_degree = incidences.get(tail, 0)
            is_spur = (head_degree == 1 and tail_degree >= 3) or (
                tail_degree == 1 and head_degree >= 3
            )
            is_stub_loop = head == tail and length < prune_length_meters
            if (is_spur and length < prune_length_meters) or is_stub_loop:
                removed += 1
                continue
            kept.append(path)
        surviving = kept
        if removed == 0:
            break
    return surviving


def merge_degree_two_chains(paths: list[list[Pixel]]) -> list[list[Pixel]]:
    incidences = count_incidences(paths)
    joinable = {pixel for pixel, count in incidences.items() if count == 2}
    remaining = list(paths)
    merged_any = True
    while merged_any:
        merged_any = False
        by_endpoint: dict[Pixel, list[int]] = {}
        for index, path in enumerate(remaining):
            for endpoint in {path[0], path[-1]}:
                by_endpoint.setdefault(endpoint, []).append(index)
        consumed: set[int] = set()
        rebuilt: list[list[Pixel]] = []
        for pixel in joinable:
            owners = [index for index in by_endpoint.get(pixel, []) if index not in consumed]
            if len(owners) != 2:
                continue
            first, second = remaining[owners[0]], remaining[owners[1]]
            if first[0] == pixel:
                first = list(reversed(first))
            if second[-1] == pixel:
                second = list(reversed(second))
            if first[-1] != pixel or second[0] != pixel:
                continue
            rebuilt.append(first + second[1:])
            consumed.add(owners[0])
            consumed.add(owners[1])
            merged_any = True
        rebuilt.extend(
            path for index, path in enumerate(remaining) if index not in consumed
        )
        remaining = rebuilt
    return remaining


def measure_width_profile(
    path: list[Pixel], distance_meters: np.ndarray, smoothing_pixels: int
) -> tuple[float, float]:
    widths = np.array(
        [2.0 * distance_meters[row, column] for row, column in path], dtype=np.float32
    )
    if widths.size == 0:
        return 0.0, 0.0
    window = max(1, smoothing_pixels | 1)
    smoothed = median_filter(widths, size=min(window, widths.size), mode="nearest")
    return float(np.min(smoothed)), float(np.mean(smoothed))


def classify_access(
    min_width_meters: float, large_unit_threshold: float, small_unit_threshold: float
) -> str:
    if min_width_meters >= large_unit_threshold:
        return "largeUnit"
    if min_width_meters >= small_unit_threshold:
        return "smallUnit"
    return "hoseOnly"


def derive_alley_segments(
    configuration: Configuration,
    obstacle_polygons: list[Polygon | MultiPolygon],
    raster_area: Polygon | MultiPolygon,
    skeleton_mask_area: Polygon | MultiPolygon,
    segment_keep_area: Polygon | MultiPolygon,
    named_road_geometry: LineString | MultiPolygon | None,
) -> tuple[list[AlleySegment], RasterFrame]:
    resolution = configuration.raster_resolution_meters
    frame = build_raster_frame(raster_area, resolution)
    announce("derive", f"grid raster {frame.column_count} x {frame.row_count} piksel")

    obstacle_raster = rasterize_polygons(frame, obstacle_polygons)
    closing_pixels = int(round(configuration.obstacle_closing_meters / resolution))
    if closing_pixels >= 1:
        obstacle_raster = binary_closing(obstacle_raster, structure=disk(closing_pixels))
    skeleton_mask_raster = rasterize_polygons(frame, [skeleton_mask_area])

    distance_pixels = distance_transform_edt(~obstacle_raster)
    distance_meters = np.asarray(distance_pixels, dtype=np.float32) * resolution

    open_space = (~obstacle_raster) & skeleton_mask_raster
    announce("derive", f"piksel ruang terbuka {int(open_space.sum())}")

    skeleton = skeletonize(open_space)
    announce("derive", f"piksel rangka {int(skeleton.sum())}")

    paths = trace_skeleton_paths(skeleton)
    announce("derive", f"lintasan rangka mentah {len(paths)}")

    paths = prune_short_spurs(
        paths, resolution, configuration.skeleton_branch_prune_meters
    )
    paths = merge_degree_two_chains(paths)
    announce("derive", f"lintasan setelah pemangkasan {len(paths)}")

    smoothing_pixels = int(round(configuration.width_profile_smoothing_meters / resolution))
    tolerance = configuration.segment_simplify_tolerance_meters
    named_road_area = named_road_geometry

    segments: list[AlleySegment] = []
    for path in paths:
        metric_points = [frame.to_metric(row, column) for row, column in path]
        line = LineString(metric_points)
        simplified = line.simplify(tolerance, preserve_topology=False)
        coordinates = [(float(x), float(y)) for x, y in simplified.coords]
        if len(coordinates) < 2:
            continue
        length_meters = float(simplified.length)
        if length_meters < configuration.minimum_segment_length_meters:
            continue
        min_width, mean_width = measure_width_profile(path, distance_meters, smoothing_pixels)
        min_width = min(min_width, MAX_REPORTED_WIDTH_METERS)
        mean_width = min(mean_width, MAX_REPORTED_WIDTH_METERS)
        access_class = classify_access(
            min_width,
            configuration.large_unit_min_width_meters,
            configuration.small_unit_min_width_meters,
        )
        midpoint = simplified.interpolate(0.5, normalized=True)
        if not segment_keep_area.contains(midpoint):
            continue
        is_named_road = bool(named_road_area is not None and named_road_area.contains(midpoint))
        segments.append(
            AlleySegment(
                id=len(segments),
                pixel_path=path,
                metric_coordinates=coordinates,
                length_meters=length_meters,
                min_width_meters=min_width,
                mean_width_meters=mean_width,
                access_class=access_class,
                is_named_road=is_named_road,
                node_pixels=(path[0], path[-1]),
            )
        )

    announce("derive", f"segmen gang {len(segments)}")
    return segments, frame


def build_named_road_area(
    road_lines: list[LineString], buffer_meters: float
) -> Polygon | MultiPolygon | None:
    if not road_lines:
        return None
    return unary_union([line.buffer(buffer_meters) for line in road_lines])


def summarise_length_by_class(segments: list[AlleySegment]) -> dict[str, float]:
    totals = {"largeUnit": 0.0, "smallUnit": 0.0, "hoseOnly": 0.0}
    for segment in segments:
        totals[segment.access_class] += segment.length_meters
    return totals
