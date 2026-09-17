import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createCanvas, drawLine, encodePng, parseHexColor } from '$lib/server/ogImage';

function readChunks(png: Buffer): { type: string; data: Buffer; checksumValid: boolean }[] {
	const chunks = [];
	let offset = 8;
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const typeAndData = png.subarray(offset + 4, offset + 8 + length);
		chunks.push({
			type: typeAndData.subarray(0, 4).toString('ascii'),
			data: typeAndData.subarray(4),
			checksumValid: png.readUInt32BE(offset + 8 + length) === crc32(typeAndData)
		});
		offset += 12 + length;
	}
	return chunks;
}

describe('gambar open graph', () => {
	it('mengurai warna hex ke tiga kanal', () => {
		expect(parseHexColor('#D6202A')).toEqual([214, 32, 42]);
	});

	it('menggambar garis mendatar tepat di baris yang diminta', () => {
		const canvas = createCanvas(10, 5, [0, 0, 0]);
		drawLine(canvas, [1, 2], [8, 2], 1, [255, 255, 255]);
		const pixelAt = (x: number, y: number) => canvas.pixels[(y * 10 + x) * 3];
		expect(pixelAt(1, 2)).toBe(255);
		expect(pixelAt(8, 2)).toBe(255);
		expect(pixelAt(0, 2)).toBe(0);
		expect(pixelAt(4, 1)).toBe(0);
		expect(pixelAt(4, 3)).toBe(0);
	});

	it('menghasilkan png sah yang isi pikselnya dapat dibaca ulang', () => {
		const canvas = createCanvas(3, 2, [1, 2, 3]);
		canvas.pixels.set([200, 100, 50], (1 * 3 + 2) * 3);
		const png = encodePng(canvas);

		expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const chunks = readChunks(png);
		expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
		expect(chunks.every((chunk) => chunk.checksumValid)).toBe(true);
		expect(chunks[0].data.readUInt32BE(0)).toBe(3);
		expect(chunks[0].data.readUInt32BE(4)).toBe(2);

		const scanlines = inflateSync(chunks[1].data);
		expect(scanlines.length).toBe((3 * 3 + 1) * 2);
		expect([...scanlines.subarray(0, 4)]).toEqual([0, 1, 2, 3]);
		expect([...scanlines.subarray(10 + 1 + 6, 10 + 1 + 9)]).toEqual([200, 100, 50]);
	});
});
