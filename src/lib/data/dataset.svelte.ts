import { base } from '$app/paths';
import { decodeAdjacencyTable, decodeBuildingTable } from '$lib/data/binary';
import { buildAlleyNetwork, listWaterSources, type GraphDocument } from '$lib/data/graph';
import { DATA_BASE_PATH } from '$lib/domain/constants';
import type {
	AdjacencyTable,
	AlleyNetwork,
	BuildingTable,
	PipelineMeta,
	WaterSource
} from '$lib/domain/types';

export type DatasetStatus = 'idle' | 'loading' | 'ready' | 'error';

function resolveDataUrl(fileName: string): string {
	return `${base}${DATA_BASE_PATH}/${fileName}`;
}

async function fetchJson<T>(fileName: string): Promise<T> {
	const response = await fetch(resolveDataUrl(fileName));
	if (!response.ok) throw new Error(`gagal memuat ${fileName}`);
	return (await response.json()) as T;
}

async function fetchBinary(fileName: string): Promise<ArrayBuffer> {
	const response = await fetch(resolveDataUrl(fileName));
	if (!response.ok) throw new Error(`gagal memuat ${fileName}`);
	return await response.arrayBuffer();
}

class DatasetStore {
	status = $state<DatasetStatus>('idle');
	errorMessage = $state('');
	meta = $state.raw<PipelineMeta | null>(null);
	buildings = $state.raw<BuildingTable | null>(null);
	adjacency = $state.raw<AdjacencyTable | null>(null);
	network = $state.raw<AlleyNetwork | null>(null);
	waterSources = $state.raw<WaterSource[]>([]);
	loadedMilliseconds = $state(0);

	get isReady(): boolean {
		return this.status === 'ready';
	}

	async load(): Promise<void> {
		if (this.status === 'loading' || this.status === 'ready') return;
		this.status = 'loading';
		const startedAt = performance.now();
		try {
			const [meta, graphDocument, buildingBuffer, adjacencyBuffer] = await Promise.all([
				fetchJson<PipelineMeta>('meta.json'),
				fetchJson<GraphDocument>('graph.json'),
				fetchBinary('buildings.bin'),
				fetchBinary('adjacency.bin')
			]);

			this.meta = meta;
			this.network = buildAlleyNetwork(graphDocument);
			this.waterSources = listWaterSources(graphDocument);
			this.buildings = decodeBuildingTable(buildingBuffer);
			this.adjacency = decodeAdjacencyTable(adjacencyBuffer);
			this.loadedMilliseconds = Math.round(performance.now() - startedAt);
			this.status = 'ready';
		} catch (failure) {
			this.errorMessage = failure instanceof Error ? failure.message : 'gagal memuat data';
			this.status = 'error';
		}
	}
}

export const dataset = new DatasetStore();
