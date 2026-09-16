import type { AlleyNetwork, BuildingTable, WaterArrivalField } from '$lib/domain/types';
import {
	collectStopPointCandidates,
	computeStopPointField,
	computeWaterArrivalField
} from '$lib/sim/stopPoint';

export function collectSupplyNodes(
	network: AlleyNetwork,
	extraWaterNodeIds: number[]
): number[] {
	const seen = new Uint8Array(network.nodeCount);
	const supply: number[] = [];
	for (const node of collectStopPointCandidates(network)) {
		if (seen[node] === 0) {
			seen[node] = 1;
			supply.push(node);
		}
	}
	for (const node of extraWaterNodeIds) {
		if (node >= 0 && node < network.nodeCount && seen[node] === 0) {
			seen[node] = 1;
			supply.push(node);
		}
	}
	return supply;
}

export function computeWaterArrival(
	network: AlleyNetwork,
	buildings: BuildingTable,
	extraWaterNodeIds: number[]
): WaterArrivalField {
	const supply = collectSupplyNodes(network, extraWaterNodeIds);
	const field = computeStopPointField(network, supply);
	return computeWaterArrivalField(field, buildings);
}
