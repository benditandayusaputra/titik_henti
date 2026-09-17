import { crc32, deflateSync } from 'node:zlib';
import { buildPlanViewport, projectPlanPoint, type PrintPlanDocument } from '$lib/data/printPlan';
import { ACCESS_CLASS_COLOR } from '$lib/domain/constants';
import type { AccessClass } from '$lib/domain/types';

export interface RgbCanvas {
	width: number;
	height: number;
	pixels: Uint8Array;
}

type Rgb = [number, number, number];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BIT_DEPTH = 8;
const PNG_COLOR_TYPE_RGB = 2;
const BYTES_PER_PIXEL = 3;
const LINE_STEP_PIXELS = 0.5;

const CONCRETE_COLOR = '#E8E6E1';
const GRAPHITE_COLOR = '#6E6E73';
const INK_COLOR = '#1A1A1C';
const PLAN_MARGIN_PIXELS = 48;
const RULER_OFFSET_PIXELS = 24;
const RULER_TICK_SPACING_PIXELS = 24;
const RULER_TICK_LENGTH_PIXELS = 6;
const RULER_MAJOR_TICK_EVERY = 5;
const ALLEY_DRAW_ORDER: AccessClass[] = ['hoseOnly', 'smallUnit', 'largeUnit'];
const ALLEY_THICKNESS_PIXELS: Record<AccessClass, number> = {
	hoseOnly: 1,
	smallUnit: 2,
	largeUnit: 3
};

export function parseHexColor(hex: string): Rgb {
	const value = Number.parseInt(hex.replace('#', ''), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function createCanvas(width: number, height: number, background: Rgb): RgbCanvas {
	const pixels = new Uint8Array(width * height * BYTES_PER_PIXEL);
	for (let offset = 0; offset < pixels.length; offset += BYTES_PER_PIXEL) {
		pixels.set(background, offset);
	}
	return { width, height, pixels };
}

function stampSquare(canvas: RgbCanvas, centerX: number, centerY: number, size: number, color: Rgb) {
	const left = Math.round(centerX - size / 2);
	const top = Math.round(centerY - size / 2);
	for (let y = Math.max(top, 0); y < Math.min(top + size, canvas.height); y += 1) {
		for (let x = Math.max(left, 0); x < Math.min(left + size, canvas.width); x += 1) {
			canvas.pixels.set(color, (y * canvas.width + x) * BYTES_PER_PIXEL);
		}
	}
}

export function drawLine(
	canvas: RgbCanvas,
	from: [number, number],
	to: [number, number],
	thickness: number,
	color: Rgb
): void {
	const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
	const steps = Math.max(1, Math.ceil(length / LINE_STEP_PIXELS));
	for (let step = 0; step <= steps; step += 1) {
		const share = step / steps;
		stampSquare(
			canvas,
			from[0] + (to[0] - from[0]) * share,
			from[1] + (to[1] - from[1]) * share,
			thickness,
			color
		);
	}
}

function buildChunk(type: string, data: Buffer): Buffer {
	const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, checksum]);
}

export function encodePng(canvas: RgbCanvas): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(canvas.width, 0);
	header.writeUInt32BE(canvas.height, 4);
	header[8] = PNG_BIT_DEPTH;
	header[9] = PNG_COLOR_TYPE_RGB;

	const rowLength = canvas.width * BYTES_PER_PIXEL;
	const scanlines = Buffer.alloc((rowLength + 1) * canvas.height);
	for (let row = 0; row < canvas.height; row += 1) {
		const source = canvas.pixels.subarray(row * rowLength, (row + 1) * rowLength);
		scanlines.set(source, row * (rowLength + 1) + 1);
	}

	return Buffer.concat([
		PNG_SIGNATURE,
		buildChunk('IHDR', header),
		buildChunk('IDAT', deflateSync(scanlines)),
		buildChunk('IEND', Buffer.alloc(0))
	]);
}

function drawPolyline(
	canvas: RgbCanvas,
	project: (x: number, y: number) => [number, number],
	points: number[],
	thickness: number,
	color: Rgb
): void {
	for (let index = 2; index < points.length; index += 2) {
		drawLine(
			canvas,
			project(points[index - 2], points[index - 1]),
			project(points[index], points[index + 1]),
			thickness,
			color
		);
	}
}

function drawRuler(canvas: RgbCanvas, color: Rgb): void {
	const bottom = canvas.height - PLAN_MARGIN_PIXELS;
	drawLine(canvas, [RULER_OFFSET_PIXELS, PLAN_MARGIN_PIXELS], [RULER_OFFSET_PIXELS, bottom], 1, color);
	for (let tick = 0; PLAN_MARGIN_PIXELS + tick * RULER_TICK_SPACING_PIXELS <= bottom; tick += 1) {
		const y = PLAN_MARGIN_PIXELS + tick * RULER_TICK_SPACING_PIXELS;
		const tickLength =
			tick % RULER_MAJOR_TICK_EVERY === 0 ? RULER_TICK_LENGTH_PIXELS * 2 : RULER_TICK_LENGTH_PIXELS;
		drawLine(canvas, [RULER_OFFSET_PIXELS, y], [RULER_OFFSET_PIXELS + tickLength, y], 1, color);
	}
}

export function renderPlanImage(plan: PrintPlanDocument, width: number, height: number): RgbCanvas {
	const canvas = createCanvas(width, height, parseHexColor(CONCRETE_COLOR));
	const viewport = buildPlanViewport(
		plan,
		width - PLAN_MARGIN_PIXELS * 2,
		height - PLAN_MARGIN_PIXELS * 2
	);
	const project = (x: number, y: number): [number, number] => {
		const [planX, planY] = projectPlanPoint(plan, viewport, x, y);
		return [planX - viewport.offsetX + PLAN_MARGIN_PIXELS, planY + PLAN_MARGIN_PIXELS];
	};

	drawRuler(canvas, parseHexColor(INK_COLOR));
	for (const ring of plan.boundary) {
		drawPolyline(canvas, project, ring, 1, parseHexColor(GRAPHITE_COLOR));
	}
	for (const accessClass of ALLEY_DRAW_ORDER) {
		const color = parseHexColor(ACCESS_CLASS_COLOR[accessClass]);
		for (const alley of plan.alleys) {
			if (alley.accessClass !== accessClass) continue;
			drawPolyline(canvas, project, alley.points, ALLEY_THICKNESS_PIXELS[accessClass], color);
		}
	}
	return canvas;
}
