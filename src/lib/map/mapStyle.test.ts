import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import { splitBasemapLayers } from '$lib/map/mapStyle';

const SUMBER_HULU = 'openmaptiles';
const SUMBER_BARU = 'basemap';

const CONTOH = [
	{ id: 'background', type: 'background' },
	{ id: 'water', type: 'fill', source: SUMBER_HULU, 'source-layer': 'water' },
	{ id: 'building', type: 'fill', source: SUMBER_HULU, 'source-layer': 'building' },
	{ id: 'highway_minor', type: 'line', source: SUMBER_HULU, 'source-layer': 'transportation' },
	{ id: 'airport', type: 'symbol', source: SUMBER_HULU, 'source-layer': 'aeroway' },
	{
		id: 'highway-name-minor',
		type: 'symbol',
		source: SUMBER_HULU,
		'source-layer': 'transportation_name'
	},
	{ id: 'ne2', type: 'raster', source: 'ne2_shaded' }
] as unknown as LayerSpecification[];

describe('splitBasemapLayers', () => {
	it('membuang latar, tapak bangunan, dan perisai jalan bawaan', () => {
		const { bawah, atas } = splitBasemapLayers(CONTOH, SUMBER_BARU);
		const semua = [...bawah, ...atas].map((lapisan) => lapisan.id);

		expect(semua).not.toContain('background');
		expect(semua).not.toContain('building');
		expect(semua).not.toContain('airport');
	});

	it('hanya mengambil lapisan dari sumber vektor hulu', () => {
		const { bawah, atas } = splitBasemapLayers(CONTOH, SUMBER_BARU);
		const semua = [...bawah, ...atas].map((lapisan) => lapisan.id);

		expect(semua).not.toContain('ne2');
		expect(semua).toContain('water');
		expect(semua).toContain('highway_minor');
	});

	it('menaruh nama jalan di atas dan geometri jalan di bawah', () => {
		const { bawah, atas } = splitBasemapLayers(CONTOH, SUMBER_BARU);

		expect(bawah.map((lapisan) => lapisan.id)).toEqual(['water', 'highway_minor']);
		expect(atas.map((lapisan) => lapisan.id)).toEqual(['highway-name-minor']);
	});

	it('mengarahkan ulang setiap lapisan ke sumber milik kita', () => {
		const { bawah, atas } = splitBasemapLayers(CONTOH, SUMBER_BARU);

		for (const lapisan of [...bawah, ...atas]) {
			expect('source' in lapisan && lapisan.source).toBe(SUMBER_BARU);
		}
	});
});
