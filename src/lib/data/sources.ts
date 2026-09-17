import adjacencyUrl from '$lib/data/files/adjacency.bin?url';
import buildingTableUrl from '$lib/data/files/buildings.bin?url';
import buildingTilesUrl from '$lib/data/files/buildings.pmtiles?url';
import alleyTilesUrl from '$lib/data/files/gangs.pmtiles?url';
import graphUrl from '$lib/data/files/graph.json?url';
import metaDocument from '$lib/data/files/meta.json';
import printPlanUrl from '$lib/data/files/print.json?url';
import type { PipelineMeta } from '$lib/domain/types';

export const DATA_URL = {
	adjacency: adjacencyUrl,
	buildingTable: buildingTableUrl,
	buildingTiles: buildingTilesUrl,
	alleyTiles: alleyTilesUrl,
	graph: graphUrl,
	printPlan: printPlanUrl
} as const;

export const pipelineMeta: PipelineMeta = metaDocument;
