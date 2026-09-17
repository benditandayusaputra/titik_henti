import { decodeAdjacencyTable, decodeBuildingTable } from '$lib/data/binary';
import { buildAlleyNetwork, listWaterSources, type GraphDocument } from '$lib/data/graph';
import { DATA_URL, pipelineMeta } from '$lib/data/sources';
import type {
	AdjacencyTable,
	AlleyNetwork,
	BuildingTable,
	PipelineMeta,
	WaterSource
} from '$lib/domain/types';

export type DatasetStatus = 'idle' | 'loading' | 'ready' | 'error';

async function fetchData(url: string): Promise<Response> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`gagal memuat ${url.split('/').pop()}`);
	return response;
}

class DatasetStore {
	status = $state<DatasetStatus>('idle');
	errorMessage = $state('');
	meta = $state.raw<PipelineMeta | null>(null);
	buildings = $state.raw<BuildingTable | null>(null);
	adjacency = $state.raw<AdjacencyTable | null>(null);
	adjacencyStatus = $state<DatasetStatus>('idle');
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
			const [graphDocument, buildingBuffer] = await Promise.all([
				fetchData(DATA_URL.graph).then((response) => response.json() as Promise<GraphDocument>),
				fetchData(DATA_URL.buildingTable).then((response) => response.arrayBuffer())
			]);

			this.meta = pipelineMeta;
			this.network = buildAlleyNetwork(graphDocument);
			this.waterSources = listWaterSources(graphDocument);
			this.buildings = decodeBuildingTable(buildingBuffer);
			this.loadedMilliseconds = Math.round(performance.now() - startedAt);
			this.status = 'ready';
		} catch (failure) {
			this.errorMessage = failure instanceof Error ? failure.message : 'gagal memuat data';
			this.status = 'error';
			return;
		}

		void this.loadAdjacency();
	}

	async loadAdjacency(): Promise<void> {
		if (this.adjacencyStatus === 'loading' || this.adjacencyStatus === 'ready') return;
		this.adjacencyStatus = 'loading';
		try {
			this.adjacency = decodeAdjacencyTable(
				await (await fetchData(DATA_URL.adjacency)).arrayBuffer()
			);
			this.adjacencyStatus = 'ready';
		} catch {
			this.adjacencyStatus = 'error';
		}
	}
}

export const dataset = new DatasetStore();
