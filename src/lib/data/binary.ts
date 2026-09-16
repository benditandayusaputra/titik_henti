import type { AdjacencyTable, BuildingTable } from '$lib/domain/types';

const ADJACENCY_MAGIC = 0x4a414854;
const BUILDING_MAGIC = 0x4c424854;
const HEADER_BYTES = 16;
const BYTES_PER_FLOAT64 = 8;
const BYTES_PER_WORD = 4;

function padToWord(count: number): number {
	return (4 - (count % 4)) % 4;
}

export function decodeBuildingTable(buffer: ArrayBuffer): BuildingTable {
	const header = new Uint32Array(buffer, 0, 4);
	if (header[0] !== BUILDING_MAGIC) {
		throw new Error('buildings.bin tidak dikenali');
	}
	const count = header[2];

	let cursor = HEADER_BYTES;
	const lon = new Float64Array(buffer, cursor, count);
	cursor += count * BYTES_PER_FLOAT64;
	const lat = new Float64Array(buffer, cursor, count);
	cursor += count * BYTES_PER_FLOAT64;
	const areaSquareMeters = new Float32Array(buffer, cursor, count);
	cursor += count * BYTES_PER_WORD;
	const heightMeters = new Float32Array(buffer, cursor, count);
	cursor += count * BYTES_PER_WORD;
	const nearestNodeId = new Int32Array(buffer, cursor, count);
	cursor += count * BYTES_PER_WORD;
	const nearestNodeDistanceMeters = new Float32Array(buffer, cursor, count);
	cursor += count * BYTES_PER_WORD;
	const materialClass = new Uint8Array(buffer, cursor, count);
	cursor += count + padToWord(count);
	const heightIsMeasured = new Uint8Array(buffer, cursor, count);

	return {
		count,
		lon,
		lat,
		areaSquareMeters,
		heightMeters,
		materialClass,
		heightIsMeasured,
		nearestNodeId,
		nearestNodeDistanceMeters
	};
}

export function decodeAdjacencyTable(buffer: ArrayBuffer): AdjacencyTable {
	const header = new Uint32Array(buffer, 0, 4);
	if (header[0] !== ADJACENCY_MAGIC) {
		throw new Error('adjacency.bin tidak dikenali');
	}
	const count = header[2];
	const pairCount = header[3];

	const offsets = new Int32Array(buffer, HEADER_BYTES, count + 1);
	const pairsOffset = HEADER_BYTES + (count + 1) * BYTES_PER_WORD;
	const interleavedWords = new Uint32Array(buffer, pairsOffset, pairCount * 2);
	const interleavedFloats = new Float32Array(buffer, pairsOffset, pairCount * 2);

	const neighbourIndex = new Uint32Array(pairCount);
	const edgeDistanceMeters = new Float32Array(pairCount);
	for (let pair = 0; pair < pairCount; pair += 1) {
		neighbourIndex[pair] = interleavedWords[pair * 2];
		edgeDistanceMeters[pair] = interleavedFloats[pair * 2 + 1];
	}

	return { count, offsets, neighbourIndex, edgeDistanceMeters };
}
