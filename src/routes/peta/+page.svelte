<script lang="ts">
	import type { Layer } from '@deck.gl/core';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import {
		BATCH_PROBE_RUN_COUNT,
		CATALOGUE_FLY_ZOOM,
		FIRE_PLAYBACK_FRAME_MILLISECONDS,
		HOSE_RULER_MAX_DURATION_MS,
		HOSE_RULER_METERS_PER_SECOND,
		HOSE_RULER_MIN_DURATION_MS,
		OPTIMIZER_DEFAULT_BUDGET_RUPIAH,
		OPTIMIZER_IGNITION_POOL_COUNT,
		OPTIMIZER_SLOWEST_SAMPLE_COUNT,
		OPTIMIZER_STEP_COUNT
	} from '$lib/domain/constants';
	import { ACCESS_CLASS_LABEL } from '$lib/domain/constants';
	import { dataset } from '$lib/data/dataset.svelte';
	import { formatMeters, formatSeconds } from '$lib/format';
	import type { ComparisonSummary, FireBatchStatistics, LonLat } from '$lib/domain/types';
	import MapCanvas from '$lib/map/MapCanvas.svelte';
	import {
		buildFireStateLayer,
		buildHosePathLayer,
		buildHoseTickLayer,
		buildInterventionLayer,
		buildPocketLayer,
		buildReachedBuildingsLayer,
		buildStopPointLayer,
		buildWaterSourceLayer,
		measureSolutionTip
	} from '$lib/map/layers';
	import { computeHoseReach } from '$lib/sim/hoseReach';
	import { fireClient } from '$lib/sim/fireClient.svelte';
	import { rankSlowestBuildings } from '$lib/sim/network';
	import { buildInterventionCandidates } from '$lib/sim/optimizer';
	import { upgradeAccessClasses } from '$lib/sim/stopPoint';
	import { computeWaterArrival } from '$lib/sim/waterArrival';
	import BuildingPanel from '$lib/ui/BuildingPanel.svelte';
	import CalibrationPanel from '$lib/ui/CalibrationPanel.svelte';
	import CataloguePanel from '$lib/ui/CataloguePanel.svelte';
	import ComparisonPanel from '$lib/ui/ComparisonPanel.svelte';
	import CorrectionPanel from '$lib/ui/CorrectionPanel.svelte';
	import DataNotice from '$lib/ui/DataNotice.svelte';
	import FirePanel from '$lib/ui/FirePanel.svelte';
	import HoseRulerOverlay from '$lib/ui/HoseRulerOverlay.svelte';
	import Legend from '$lib/ui/Legend.svelte';
	import OptimizerPanel from '$lib/ui/OptimizerPanel.svelte';
	import SegmentPanel from '$lib/ui/SegmentPanel.svelte';
	import StatsPanel from '$lib/ui/StatsPanel.svelte';
	import StopPointPanel from '$lib/ui/StopPointPanel.svelte';
	import WaterPanel from '$lib/ui/WaterPanel.svelte';
	import { workspace, type WorkspaceTab } from '$lib/workspace.svelte';

	const tabs: { id: WorkspaceTab; label: string }[] = [
		{ id: 'akses', label: 'Akses' },
		{ id: 'daftar', label: 'Daftar' },
		{ id: 'titikHenti', label: 'Titik henti' },
		{ id: 'api', label: 'Api' },
		{ id: 'air', label: 'Air' },
		{ id: 'intervensi', label: 'Intervensi' }
	];

	let mapInstance = $state<MapLibreMap | null>(null);
	let hoseDrawnMeters = $state(0);
	let comparisonRunning = $state(false);
	let budgetRupiah = $state(OPTIMIZER_DEFAULT_BUDGET_RUPIAH);
	let prefersReducedMotion = $state(false);
	let selectionAnnouncement = $state('');
	let batchStatistics = $state.raw<FireBatchStatistics | null>(null);
	let batchRunning = $state(false);
	let animationHandle = 0;
	let playbackHandle = 0;

	onMount(() => {
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		void dataset.load();
		return () => {
			cancelAnimationFrame(animationHandle);
			cancelAnimationFrame(playbackHandle);
			fireClient.stop();
		};
	});

	$effect(() => {
		if (!dataset.isReady) return;
		const buildings = dataset.buildings;
		const adjacency = dataset.adjacency;
		const network = dataset.network;
		if (buildings && adjacency && network) {
			fireClient.start(buildings, adjacency, network);
		}
	});

	$effect(() => {
		const solution = workspace.stopPointSolution;
		cancelAnimationFrame(animationHandle);
		if (!solution || !solution.reachable) {
			hoseDrawnMeters = 0;
			return;
		}
		const target = solution.hoseLengthMeters;
		if (prefersReducedMotion) {
			hoseDrawnMeters = target;
			return;
		}
		const durationMs = Math.min(
			HOSE_RULER_MAX_DURATION_MS,
			Math.max(HOSE_RULER_MIN_DURATION_MS, (target / HOSE_RULER_METERS_PER_SECOND) * 1000)
		);
		const startedAt = performance.now();
		hoseDrawnMeters = 0;
		const advance = (now: number) => {
			const progress = Math.min(1, (now - startedAt) / durationMs);
			const eased = 1 - Math.pow(1 - progress, 3);
			hoseDrawnMeters = target * eased;
			if (progress < 1) animationHandle = requestAnimationFrame(advance);
		};
		animationHandle = requestAnimationFrame(advance);
		return () => cancelAnimationFrame(animationHandle);
	});

	$effect(() => {
		const playback = workspace.playback;
		cancelAnimationFrame(playbackHandle);
		if (!playback.playing || playback.snapshots.length === 0) return;
		let lastFrameAt = performance.now();
		const advance = (now: number) => {
			if (now - lastFrameAt >= FIRE_PLAYBACK_FRAME_MILLISECONDS) {
				lastFrameAt = now;
				const next = workspace.playback.currentStep + 1;
				if (next >= workspace.playback.snapshots.length) {
					workspace.playback = { ...workspace.playback, playing: false };
					return;
				}
				workspace.playback = { ...workspace.playback, currentStep: next };
			}
			playbackHandle = requestAnimationFrame(advance);
		};
		playbackHandle = requestAnimationFrame(advance);
		return () => cancelAnimationFrame(playbackHandle);
	});

	const hoseTip = $derived.by<LonLat | null>(() => {
		const solution = workspace.stopPointSolution;
		if (!solution || !solution.reachable) return null;
		return measureSolutionTip(solution, hoseDrawnMeters);
	});

	const deckLayers = $derived.by<Layer[]>(() => {
		const layers: Layer[] = [];
		const buildings = dataset.buildings;
		if (!buildings) return layers;

		if (workspace.activeTab === 'air' && workspace.hoseReach) {
			layers.push(...buildReachedBuildingsLayer(buildings, workspace.hoseReach));
			layers.push(...buildPocketLayer(buildings, workspace.hoseReach.pockets));
		}

		const fireState = workspace.currentFireState;
		if (fireState) {
			layers.push(...buildFireStateLayer(buildings, fireState));
		}

		layers.push(...buildWaterSourceLayer(workspace.listWaterSourcesForMap()));

		if (workspace.optimizerOutcome) {
			layers.push(
				...buildInterventionLayer(
					workspace.optimizerOutcome.selected.map((item) => item.position)
				)
			);
		}

		const solution = workspace.stopPointSolution;
		if (solution) {
			layers.push(...buildHosePathLayer(solution, hoseDrawnMeters));
			layers.push(...buildHoseTickLayer(solution, hoseDrawnMeters));
			layers.push(...buildStopPointLayer(solution));
		}

		return layers;
	});

	function handleBuildingPick(buildingIndex: number): void {
		if (workspace.settingIgnition) {
			workspace.toggleIgnition(buildingIndex);
			return;
		}
		workspace.selectBuilding(buildingIndex);
		if (workspace.activeTab === 'akses') workspace.activeTab = 'titikHenti';
	}

	function handleSegmentPick(segmentId: number): void {
		workspace.selectSegment(segmentId);
		workspace.activeTab = 'akses';
	}

	function focusMapOn(position: LonLat): void {
		mapInstance?.flyTo({
			center: [position.lon, position.lat],
			zoom: Math.max(mapInstance.getZoom(), CATALOGUE_FLY_ZOOM),
			duration: prefersReducedMotion ? 0 : 600
		});
	}

	function handleSegmentPickFromTable(segmentId: number): void {
		workspace.selectSegment(segmentId);
		const row = workspace.segmentRows.find((candidate) => candidate.segmentId === segmentId);
		if (!row) return;
		focusMapOn(row.midpoint);
		selectionAnnouncement = `Segmen ${row.segmentId} dipilih, kelas ${ACCESS_CLASS_LABEL[row.accessClass]}, lebar minimum ${formatMeters(row.minWidthMeters, 2)}, panjang ${formatMeters(row.lengthMeters, 1)}.`;
	}

	function handleBuildingPickFromTable(buildingIndex: number): void {
		workspace.selectBuilding(buildingIndex);
		const row = workspace.buildingRows.find(
			(candidate) => candidate.buildingIndex === buildingIndex
		);
		if (!row) return;
		focusMapOn(row.position);
		selectionAnnouncement = row.reachable
			? `Bangunan ${row.buildingIndex} dipilih, air sampai dalam ${formatSeconds(row.waterArrivalSeconds)}.`
			: `Bangunan ${row.buildingIndex} dipilih, tidak terjangkau air dari sumber mana pun.`;
	}

	function handleMapPick(position: LonLat): void {
		if (workspace.placingHydrant) {
			workspace.addHypotheticalSource(position);
		}
	}

	function runSimulation(): void {
		const waterArrival = workspace.waterArrival;
		if (!waterArrival) return;
		workspace.playback = {
			snapshots: [],
			timeline: [],
			currentStep: 0,
			running: true,
			playing: false,
			secondsToTenBuildings: Infinity
		};
		fireClient.run(
			{
				ignitionBuildingIndices: workspace.ignitionBuildingIndices,
				wind: workspace.wind,
				randomSeed: workspace.randomSeed,
				stepSeconds: workspace.stepSeconds,
				stepCount: workspace.stepCount,
				suppressionEnabled: workspace.suppressionEnabled
			},
			workspace.coefficients,
			workspace.suppressionEnabled ? waterArrival.secondsPerBuilding : null,
			null,
			(message) => {
				workspace.playback = {
					...workspace.playback,
					snapshots: [...workspace.playback.snapshots, message.state],
					timeline: [...workspace.playback.timeline, message.summary],
					currentStep: workspace.playback.snapshots.length
				};
			},
			(message) => {
				workspace.playback = {
					...workspace.playback,
					running: false,
					playing: true,
					currentStep: 0,
					secondsToTenBuildings: message.secondsToTenBuildings
				};
			}
		);
	}

	function summariseScenario(
		label: string,
		burntCount: number,
		savedCount: number,
		meanWaterArrivalSeconds: number,
		worstWaterArrivalSeconds: number,
		unreachableBuildingCount: number
	): ComparisonSummary {
		return {
			label,
			burntCount,
			savedCount,
			meanWaterArrivalSeconds,
			worstWaterArrivalSeconds,
			unreachableBuildingCount
		};
	}

	async function runComparison(): Promise<void> {
		const buildings = dataset.buildings;
		const adjacency = dataset.adjacency;
		const baseNetwork = dataset.network;
		if (!buildings || !adjacency || !baseNetwork) return;
		if (workspace.ignitionBuildingIndices.length === 0) return;

		comparisonRunning = true;
		const scenarios: ComparisonSummary[] = [];
		const networks = [
			{ label: 'Jaringan sekarang', network: baseNetwork },
			{ label: 'Semua gang naik satu kelas', network: upgradeAccessClasses(baseNetwork) }
		];

		for (const entry of networks) {
			const arrival = computeWaterArrival(entry.network, buildings, workspace.extraWaterNodeIds);
			const reach = computeHoseReach({
				network: entry.network,
				buildings,
				adjacency,
				sourceNodeIds: [
					...workspace.realWaterSources.map((source) => source.nearestNodeId),
					...workspace.hypotheticalSources.map((source) => source.nodeId)
				],
				maximumHoseLengthMeters: workspace.maximumHoseLengthMeters
			});
			const outcome = await runScenarioInWorker(arrival.secondsPerBuilding);
			scenarios.push(
				summariseScenario(
					entry.label,
					outcome.burntCount,
					outcome.savedCount,
					arrival.meanSecondsReachable,
					arrival.worstSecondsReachable,
					reach.unreachedBuildingCount
				)
			);
		}

		workspace.comparison = scenarios;
		comparisonRunning = false;
	}

	function runScenarioInWorker(
		waterArrivalSeconds: Float32Array
	): Promise<{ burntCount: number; savedCount: number }> {
		return new Promise((resolve) => {
			let lastSummary = { burntCount: 0, savedCount: 0 };
			fireClient.run(
				{
					ignitionBuildingIndices: workspace.ignitionBuildingIndices,
					wind: workspace.wind,
					randomSeed: workspace.randomSeed,
					stepSeconds: workspace.stepSeconds,
					stepCount: workspace.stepCount,
					suppressionEnabled: true
				},
				workspace.coefficients,
				waterArrivalSeconds,
				null,
				(message) => {
					lastSummary = {
						burntCount: message.summary.burntCount + message.summary.burningCount,
						savedCount: message.summary.savedCount
					};
				},
				() => resolve(lastSummary)
			);
		});
	}

	function runBatchProbe(): void {
		const arrival = workspace.waterArrival;
		if (!arrival) return;
		batchRunning = true;
		fireClient.runBatch(
			BATCH_PROBE_RUN_COUNT,
			workspace.coefficients,
			arrival.secondsPerBuilding,
			workspace.stepSeconds,
			OPTIMIZER_STEP_COUNT,
			workspace.randomSeed,
			(statistics) => {
				batchStatistics = statistics;
				batchRunning = false;
			}
		);
	}

	function runOptimizer(): void {
		const buildings = dataset.buildings;
		const network = workspace.network;
		const arrival = workspace.waterArrival;
		if (!buildings || !network || !arrival) return;

		const slowest = rankSlowestBuildings(arrival.secondsPerBuilding, OPTIMIZER_SLOWEST_SAMPLE_COUNT);
		const candidates = buildInterventionCandidates(network, buildings, slowest);

		workspace.optimizerRunning = true;
		workspace.optimizerProgress = { completed: 0, total: 1, note: 'Menyiapkan kandidat' };
		fireClient.optimize(
			budgetRupiah,
			workspace.coefficients,
			candidates,
			workspace.stepSeconds,
			Math.min(workspace.stepCount, OPTIMIZER_STEP_COUNT),
			workspace.randomSeed,
			workspace.extraWaterNodeIds,
			workspace.maximumHoseLengthMeters,
			rankSlowestBuildings(arrival.secondsPerBuilding, OPTIMIZER_IGNITION_POOL_COUNT),
			(message) => {
				workspace.optimizerProgress = {
					completed: message.completedRounds,
					total: message.totalRounds,
					note: message.note
				};
			},
			(outcome) => {
				workspace.optimizerOutcome = outcome;
				workspace.optimizerRunning = false;
			}
		);
	}

	function applyOptimizerResult(): void {
		const outcome = workspace.optimizerOutcome;
		if (!outcome) return;
		const nodeIds: number[] = [];
		const segmentIds: number[] = [];
		for (const item of outcome.selected) {
			if (item.kind === 'wideningSegment' && item.targetEdgeId !== null) {
				segmentIds.push(item.targetEdgeId);
			} else if (item.targetNodeId !== null) {
				nodeIds.push(item.targetNodeId);
			}
		}
		workspace.appliedInterventionNodeIds = nodeIds;
		workspace.appliedInterventionSegmentIds = segmentIds;
	}
</script>

<svelte:head>
	<title>Lembar Kerja — Titik Henti</title>
</svelte:head>

<h1 class="sr-only">Lembar kerja pra-rencana kebakaran</h1>

<p class="sr-only" role="status" aria-live="polite">{selectionAnnouncement}</p>

<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
	<div class="bg-ink-deep relative min-h-[58vh] flex-1 lg:min-h-0">
		{#if dataset.meta}
			<MapCanvas
				bounds={dataset.meta.boundingBox}
				layers={deckLayers}
				upgradedAlleys={workspace.wideningScenarioActive}
				selectedBuildingIndex={workspace.selectedBuildingIndex}
				selectedSegmentId={workspace.selectedSegmentId}
				correctedSegmentIds={workspace.correctedSegmentIds}
				ignitionBuildingIndices={workspace.ignitionBuildingIndices}
				onbuildingpick={handleBuildingPick}
				onsegmentpick={handleSegmentPick}
				onmappick={handleMapPick}
				onready={(map) => (mapInstance = map)}
			/>
			<HoseRulerOverlay
				map={mapInstance}
				tip={hoseTip}
				meters={hoseDrawnMeters}
				totalMeters={workspace.stopPointSolution?.hoseLengthMeters ?? 0}
			/>
			<div class="absolute bottom-4 left-4 z-10">
				<Legend upgraded={workspace.wideningScenarioActive} />
			</div>
			{#if workspace.settingIgnition || workspace.placingHydrant}
				<div
					class="bg-ink text-concrete map-label absolute top-3 left-1/2 z-10 -translate-x-1/2 px-3 py-2"
				>
					{workspace.settingIgnition ? 'Klik bangunan untuk titik api' : 'Klik peta untuk hidran'}
				</div>
			{/if}
		{:else}
			<div class="flex h-full items-center px-6">
				<div>
					<p class="font-display text-concrete text-[18px] leading-tight font-semibold">
						{dataset.status === 'error' ? 'Berkas data gagal dimuat' : 'Memuat berkas data'}
					</p>
					<p class="text-graphite-pale prose-measure mt-2 text-[12.5px] leading-[1.55]">
						{dataset.status === 'error'
							? dataset.errorMessage
							: 'Peta, jaringan gang, dan tabel bangunan sedang diambil dari aset statis.'}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<aside class="hairline-l bg-paper flex w-full shrink-0 flex-col lg:w-[382px]">
		<nav class="hairline-b bg-paper flex overflow-x-auto" aria-label="Panel kerja">
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class="field-tab hairline-r shrink-0"
					class:bg-paper={workspace.activeTab === tab.id}
					class:text-ink={workspace.activeTab === tab.id}
					aria-pressed={workspace.activeTab === tab.id}
					onclick={() => (workspace.activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</nav>

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if dataset.meta && dataset.buildings && workspace.network}
				{#if workspace.activeTab === 'akses'}
					<StatsPanel meta={dataset.meta} />
					{#if workspace.selectedBuildingIndex !== null}
						<BuildingPanel
							buildings={dataset.buildings}
							network={workspace.network}
							buildingIndex={workspace.selectedBuildingIndex}
						/>
					{/if}
					{#if workspace.selectedSegment}
						<SegmentPanel segment={workspace.selectedSegment} />
					{/if}
					<CorrectionPanel
						segment={workspace.selectedSegment}
						records={workspace.corrections}
						submitting={workspace.correctionSubmitting}
						errorMessage={workspace.correctionErrorMessage}
						onsubmit={(sentence) => void workspace.requestCorrection(sentence)}
						ondecide={(id, approved) =>
							workspace.setCorrectionStatus(id, approved ? 'approved' : 'rejected')}
					/>
				{:else if workspace.activeTab === 'daftar'}
					{#if workspace.selectedSegment}
						<SegmentPanel segment={workspace.selectedSegment} />
					{/if}
					{#if workspace.selectedBuildingIndex !== null}
						<BuildingPanel
							buildings={dataset.buildings}
							network={workspace.network}
							buildingIndex={workspace.selectedBuildingIndex}
						/>
					{/if}
					<CataloguePanel
						segmentRows={workspace.segmentRows}
						buildingRows={workspace.buildingRows}
						selectedSegmentId={workspace.selectedSegmentId}
						selectedBuildingIndex={workspace.selectedBuildingIndex}
						onsegmentpick={handleSegmentPickFromTable}
						onbuildingpick={handleBuildingPickFromTable}
					/>
				{:else if workspace.activeTab === 'titikHenti'}
					{#if workspace.selectedBuildingIndex !== null}
						<BuildingPanel
							buildings={dataset.buildings}
							network={workspace.network}
							buildingIndex={workspace.selectedBuildingIndex}
						/>
					{/if}
					<StopPointPanel solution={workspace.stopPointSolution} drawnMeters={hoseDrawnMeters} />
					<ComparisonPanel oncompare={runComparison} running={comparisonRunning} />
				{:else if workspace.activeTab === 'api'}
					<FirePanel
						waterArrival={workspace.waterArrival}
						onrun={runSimulation}
						onreset={() => {
							fireClient.cancelActiveRun();
							workspace.resetPlayback();
						}}
						buildingCount={dataset.buildings.count}
					/>
					<CalibrationPanel />
				{:else if workspace.activeTab === 'air'}
					<WaterPanel
						reach={workspace.hoseReach}
						sources={workspace.listWaterSourcesForMap()}
						buildingCount={dataset.buildings.count}
					/>
				{:else}
					<OptimizerPanel
						{budgetRupiah}
						{batchStatistics}
						{batchRunning}
						onbudgetchange={(value) => (budgetRupiah = value)}
						onrun={runOptimizer}
						onapply={applyOptimizerResult}
						onprobe={runBatchProbe}
					/>
				{/if}
			{/if}
		</div>

		{#if dataset.meta}
			<DataNotice meta={dataset.meta} />
		{/if}
	</aside>
</div>
