import type { AccessClass } from '$lib/domain/types';

export interface PrintPlanDocument {
	originLon: number;
	originLat: number;
	quantisationDegrees: number;
	buildings: number[][];
	alleys: { accessClass: AccessClass; points: number[]; lengthMeters: number }[];
	boundary: number[][];
}

export interface PlanViewport {
	minX: number;
	minY: number;
	width: number;
	height: number;
	scale: number;
	offsetX: number;
	offsetY: number;
}

export function measurePlanExtent(plan: PrintPlanDocument): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
} {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const ring of plan.buildings) {
		for (let index = 0; index < ring.length; index += 2) {
			if (ring[index] < minX) minX = ring[index];
			if (ring[index] > maxX) maxX = ring[index];
			if (ring[index + 1] < minY) minY = ring[index + 1];
			if (ring[index + 1] > maxY) maxY = ring[index + 1];
		}
	}
	return { minX, minY, maxX, maxY };
}

export function buildPlanViewport(
	plan: PrintPlanDocument,
	canvasWidth: number,
	canvasHeight: number
): PlanViewport {
	const extent = measurePlanExtent(plan);
	const spanX = extent.maxX - extent.minX;
	const spanY = extent.maxY - extent.minY;
	const latitudeCosine = Math.cos((plan.originLat * Math.PI) / 180);
	const aspectCorrectedSpanX = spanX * latitudeCosine;
	const scale = Math.min(canvasWidth / aspectCorrectedSpanX, canvasHeight / spanY);
	return {
		minX: extent.minX,
		minY: extent.minY,
		width: aspectCorrectedSpanX * scale,
		height: spanY * scale,
		scale,
		offsetX: (canvasWidth - aspectCorrectedSpanX * scale) / 2,
		offsetY: (canvasHeight - spanY * scale) / 2
	};
}

export function projectPlanPoint(
	plan: PrintPlanDocument,
	viewport: PlanViewport,
	x: number,
	y: number
): [number, number] {
	const latitudeCosine = Math.cos((plan.originLat * Math.PI) / 180);
	return [
		viewport.offsetX + (x - viewport.minX) * latitudeCosine * viewport.scale,
		viewport.offsetY + viewport.height - (y - viewport.minY) * viewport.scale
	];
}

export function buildPolygonPath(
	plan: PrintPlanDocument,
	viewport: PlanViewport,
	ring: number[]
): string {
	const commands: string[] = [];
	for (let index = 0; index < ring.length; index += 2) {
		const [x, y] = projectPlanPoint(plan, viewport, ring[index], ring[index + 1]);
		commands.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	commands.push('Z');
	return commands.join(' ');
}

export function buildLinePath(
	plan: PrintPlanDocument,
	viewport: PlanViewport,
	points: number[]
): string {
	const commands: string[] = [];
	for (let index = 0; index < points.length; index += 2) {
		const [x, y] = projectPlanPoint(plan, viewport, points[index], points[index + 1]);
		commands.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	return commands.join(' ');
}

export function mergeBuildingPaths(
	plan: PrintPlanDocument,
	viewport: PlanViewport
): string {
	return plan.buildings.map((ring) => buildPolygonPath(plan, viewport, ring)).join(' ');
}

export function mergeAlleyPaths(
	plan: PrintPlanDocument,
	viewport: PlanViewport,
	accessClass: AccessClass
): string {
	return plan.alleys
		.filter((alley) => alley.accessClass === accessClass)
		.map((alley) => buildLinePath(plan, viewport, alley.points))
		.join(' ');
}
