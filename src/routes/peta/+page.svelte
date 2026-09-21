<script lang="ts">
	import PageMeta from '$lib/ui/PageMeta.svelte';
	import { keyboardScrollable } from '$lib/ui/keyboardScrollable';
	import PanduanPemakaian from '$lib/ui/PanduanPemakaian.svelte';
	import { panduan } from '$lib/ui/panduan.svelte';
	import type { Layer } from '@deck.gl/core';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import {
		APPLIANCE_STAND_SPACING_METERS,
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
	import { pipelineMeta } from '$lib/data/sources';
	import { formatMeters, formatSeconds } from '$lib/format';
	import type { ComparisonSummary, FireBatchStatistics, LonLat } from '$lib/domain/types';
	import MapCanvas from '$lib/map/MapCanvas.svelte';
	import { computeHoseReach } from '$lib/sim/hoseReach';
	import { fireClient } from '$lib/sim/fireClient.svelte';
	import { rankSlowestBuildings } from '$lib/sim/network';
	import { buildInterventionCandidates } from '$lib/sim/optimizer';
	import { collectApplianceStandNodes, upgradeAccessClasses } from '$lib/sim/stopPoint';
	import { computeWaterArrival } from '$lib/sim/waterArrival';
	import BuildingPanel from '$lib/ui/BuildingPanel.svelte';
	import CalibrationPanel from '$lib/ui/CalibrationPanel.svelte';
	import CataloguePanel from '$lib/ui/CataloguePanel.svelte';
	import ComparisonPanel from '$lib/ui/ComparisonPanel.svelte';
	import CorrectionPanel from '$lib/ui/CorrectionPanel.svelte';
	import DataNotice from '$lib/ui/DataNotice.svelte';
	import DataUnavailable from '$lib/ui/DataUnavailable.svelte';
	import FirePanel from '$lib/ui/FirePanel.svelte';
	import HoseRulerOverlay from '$lib/ui/HoseRulerOverlay.svelte';
	import TitikHentiMarker from '$lib/ui/TitikHentiMarker.svelte';
	import Legend from '$lib/ui/Legend.svelte';
	import OptimizerPanel from '$lib/ui/OptimizerPanel.svelte';
	import PanelSkeleton from '$lib/ui/PanelSkeleton.svelte';
	import SegmentPanel from '$lib/ui/SegmentPanel.svelte';
	import StatsPanel from '$lib/ui/StatsPanel.svelte';
	import StopPointPanel from '$lib/ui/StopPointPanel.svelte';
	import WaterPanel from '$lib/ui/WaterPanel.svelte';
	import { workspace, type WorkspaceTab } from '$lib/workspace.svelte';

	const langkahTabs: { id: WorkspaceTab; label: string }[] = [
		{ id: 'titikHenti', label: '1 Titik henti' },
		{ id: 'api', label: '2 Sebaran api' }
	];

	const telaahTabs: { id: WorkspaceTab; label: string }[] = [
		{ id: 'akses', label: 'Akses' },
		{ id: 'daftar', label: 'Daftar' },
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
	let mapArea: HTMLDivElement | undefined = $state();
	let panelContent: HTMLDivElement | undefined = $state();
	let lapisanPeta = $state.raw<typeof import('$lib/map/layers') | null>(null);
	let animationHandle = 0;
	let playbackHandle = 0;

	onMount(() => {
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		void import('$lib/map/layers').then((modul) => (lapisanPeta = modul));
		void dataset.load();
		panduan.tawarkanSekali();
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
		const pembangun = lapisanPeta;
		const solution = workspace.stopPointSolution;
		if (!pembangun || !solution || !solution.reachable) return null;
		return pembangun.measureSolutionTip(solution, hoseDrawnMeters);
	});

	const deckLayers = $derived.by<Layer[]>(() => {
		const layers: Layer[] = [];
		const pembangun = lapisanPeta;
		const buildings = dataset.buildings;
		if (!pembangun || !buildings) return layers;

		if (workspace.activeTab === 'air' && workspace.hoseReach) {
			layers.push(...pembangun.buildReachedBuildingsLayer(buildings, workspace.hoseReach));
			layers.push(...pembangun.buildPocketLayer(buildings, workspace.hoseReach.pockets));
		}

		const fireState = workspace.currentFireState;
		if (fireState) {
			layers.push(...pembangun.buildFireStateLayer(buildings, fireState));
		}

		layers.push(...pembangun.buildWaterSourceLayer(workspace.listWaterSourcesForMap()));

		if (workspace.optimizerOutcome) {
			layers.push(
				...pembangun.buildInterventionLayer(
					workspace.optimizerOutcome.selected.map((item) => item.position)
				)
			);
		}

		const solution = workspace.stopPointSolution;
		if (solution) {
			layers.push(...pembangun.buildHosePathLayer(solution, hoseDrawnMeters));
			layers.push(...pembangun.buildHoseTickLayer(solution, hoseDrawnMeters));
		}

		return layers;
	});

	let tabSebelumnya = $state.raw<WorkspaceTab | null>(null);

	$effect(() => {
		const tab = workspace.activeTab;
		if (panelContent) panelContent.scrollTop = 0;
		if (tab === tabSebelumnya) return;
		tabSebelumnya = tab;
		workspace.settingIgnition = false;
		workspace.placingHydrant = false;
	});

	$effect(() => {
		const choosingOnMap = workspace.settingIgnition || workspace.placingHydrant;
		if (choosingOnMap) bringMapIntoView();
	});

	function bringMapIntoView(): void {
		if (!mapArea) return;
		const mastheadBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
		const mapTop = mapArea.getBoundingClientRect().top;
		if (mapTop >= mastheadBottom) return;
		window.scrollBy({ top: mapTop - mastheadBottom, behavior: 'instant' });
	}

	function handleBuildingPick(buildingIndex: number, position: LonLat): void {
		if (workspace.settingIgnition) {
			workspace.toggleIgnition(buildingIndex);
			return;
		}
		if (workspace.placingHydrant) {
			workspace.addHypotheticalSource(position);
			return;
		}
		workspace.selectBuilding(buildingIndex);
		if (workspace.activeTab === 'akses') workspace.activeTab = 'titikHenti';
	}

	function handleSegmentPick(segmentId: number, position: LonLat): void {
		if (workspace.placingHydrant) {
			workspace.addHypotheticalSource(position);
			return;
		}
		if (workspace.settingIgnition) return;
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

	function reloadDataset(): void {
		void dataset.load();
	}

	function handleMapPick(position: LonLat): void {
		if (workspace.placingHydrant) {
			workspace.addHypotheticalSource(position);
		}
	}

	function runSimulation(): void {
		const waterArrival = workspace.waterArrival;
		if (!waterArrival) return;
		bringMapIntoView();
		workspace.simulationFailure = null;
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
			},
			(cause) => {
				workspace.playback = { ...workspace.playback, running: false, playing: false };
				workspace.simulationFailure = { task: 'run', cause };
			}
		);
	}

	function retryWithDefaultParameters(): void {
		workspace.resetCoefficients();
		workspace.simulationFailure = null;
		runSimulation();
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

		workspace.simulationFailure = null;
		for (const entry of networks) {
			const arrival = computeWaterArrival(entry.network, buildings, workspace.extraWaterNodeIds);
			const reach = computeHoseReach({
				network: entry.network,
				buildings,
				adjacency,
				sourceNodeIds: [
					...workspace.realWaterSources
						.filter((source) => source.kind !== 'applianceStand')
						.map((source) => source.nearestNodeId),
					...collectApplianceStandNodes(entry.network, APPLIANCE_STAND_SPACING_METERS),
					...workspace.hypotheticalSources.map((source) => source.nodeId)
				],
				maximumHoseLengthMeters: workspace.maximumHoseLengthMeters
			});
			const outcome = await runScenarioInWorker(arrival.secondsPerBuilding);
			if (!outcome) {
				comparisonRunning = false;
				return;
			}
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
	): Promise<{ burntCount: number; savedCount: number } | null> {
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
				() => resolve(lastSummary),
				(cause) => {
					workspace.simulationFailure = { task: 'run', cause };
					resolve(null);
				}
			);
		});
	}

	function runBatchProbe(): void {
		const arrival = workspace.waterArrival;
		if (!arrival) return;
		batchRunning = true;
		workspace.simulationFailure = null;
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
			},
			(cause) => {
				batchRunning = false;
				workspace.simulationFailure = { task: 'batch', cause };
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
		workspace.simulationFailure = null;
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
			},
			(cause) => {
				workspace.optimizerRunning = false;
				workspace.simulationFailure = { task: 'optimize', cause };
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

<PageMeta
	title="Lembar kerja — Titik Henti"
	description="Peta kelas gang Kelurahan Palmerah dengan titik henti kendaraan, panjang selang, simulasi penjalaran api, dan jangkauan air."
/>

<h1 class="sr-only">Lembar kerja pra-rencana kebakaran</h1>

<p class="sr-only" role="status" aria-live="polite">{selectionAnnouncement}</p>

<PanduanPemakaian />

<div class="flex min-h-0 flex-1 flex-col lg:flex-row" data-lembar-kerja>
	<div
		class="bg-concrete relative min-h-[58vh] flex-1 overflow-hidden lg:min-h-0"
		bind:this={mapArea}
		data-panduan="peta"
	>
		<MapCanvas
			bounds={pipelineMeta.boundingBox}
			layers={deckLayers}
			upgradedAlleys={workspace.wideningScenarioActive}
			mutedAlleyClasses={workspace.activeTab === 'api'}
			selectedBuildingIndex={workspace.selectedBuildingIndex}
			selectedSegmentId={workspace.selectedSegmentId}
			correctedSegmentIds={workspace.correctedSegmentIds}
			ignitionBuildingIndices={workspace.ignitionBuildingIndices}
			onbuildingpick={handleBuildingPick}
			onsegmentpick={handleSegmentPick}
			onmappick={handleMapPick}
			onready={(map) => (mapInstance = map)}
		/>
		<TitikHentiMarker
			map={mapInstance}
			stopPoint={workspace.stopPointSolution?.reachable
				? workspace.stopPointSolution.stopPoint
				: null}
		/>
		<HoseRulerOverlay
			map={mapInstance}
			tip={hoseTip}
			meters={hoseDrawnMeters}
			totalMeters={workspace.stopPointSolution?.hoseLengthMeters ?? 0}
		/>
		<div class="absolute bottom-4 left-4 z-10">
			<Legend upgraded={workspace.wideningScenarioActive} muted={workspace.activeTab === 'api'} />
		</div>
		<button
			type="button"
			class="field-button bg-concrete absolute top-3 right-3 z-10 focus-visible:[outline-offset:-2px]"
			onclick={() => panduan.buka()}
		>
			Panduan
		</button>
		{#if workspace.settingIgnition || workspace.placingHydrant}
			<div
				class="bg-ink text-concrete map-label absolute top-3 left-1/2 z-10 -translate-x-1/2 px-3 py-2"
			>
				{workspace.settingIgnition ? 'Pilih bangunan untuk titik api' : 'Pilih titik di peta untuk hidran'}
			</div>
		{:else if workspace.selectedBuildingIndex === null && dataset.isReady}
			<div
				class="bg-ink text-concrete map-label absolute top-3 left-1/2 z-10 -translate-x-1/2 px-3 py-2"
			>
				Ketuk rumah yang terbakar
			</div>
		{/if}
		{#if dataset.status === 'error'}
			<div class="bg-concrete/95 absolute inset-0 z-20 flex items-center px-6 py-10">
				<DataUnavailable tone="terang" onretry={reloadDataset} />
			</div>
		{:else if !dataset.isReady}
			<div
				class="bg-paper/95 border-ink/25 absolute top-3 left-3 z-20 max-w-[280px] border px-3 py-2"
				aria-busy="true"
			>
				<p class="font-display text-ink text-[13px] leading-tight font-semibold" role="status">
					Memuat peta wilayah
				</p>
				<p class="text-graphite mt-1 text-[11.5px] leading-[1.45]">
					Jaringan gang dan tabel bangunan sedang diambil. Peta sudah bisa digeser sambil menunggu.
				</p>
			</div>
		{/if}
	</div>

	<aside class="hairline-l bg-paper flex w-full shrink-0 flex-col lg:w-[382px]">
		<nav class="hairline-b bg-paper" aria-label="Panel kerja" data-panduan="tab">
			<div class="flex">
				{#each langkahTabs as tab (tab.id)}
					{@const aktif = workspace.activeTab === tab.id}
					<button
						type="button"
						class="hairline-r flex-1 cursor-pointer px-3 py-3 transition-colors duration-100"
						class:bg-ink={aktif}
						aria-pressed={aktif}
						onclick={() => (workspace.activeTab = tab.id)}
					>
						<span
							class="font-display text-[13.5px] leading-none font-semibold"
							class:text-concrete={aktif}
							class:text-graphite={!aktif}
						>
							{tab.label}
						</span>
					</button>
				{/each}
			</div>
			<div class="hairline-t flex items-center overflow-x-auto">
				<span class="field-label-sm text-graphite hairline-r shrink-0 px-3 py-2">Telaah</span>
				{#each telaahTabs as tab (tab.id)}
					<button
						type="button"
						class="field-tab hairline-r shrink-0"
						class:text-ink={workspace.activeTab === tab.id}
						aria-pressed={workspace.activeTab === tab.id}
						onclick={() => (workspace.activeTab = tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</nav>

		<div
			class="min-h-0 flex-1 overflow-y-auto"
			role="region"
			aria-label="Isi panel kerja"
			bind:this={panelContent}
			{@attach keyboardScrollable}
		>
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
						onsubmit={(sentence) => workspace.requestCorrection(sentence)}
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
					<StopPointPanel solution={workspace.stopPointSolution} drawnMeters={hoseDrawnMeters} />
					{#if workspace.selectedBuildingIndex !== null}
						<BuildingPanel
							buildings={dataset.buildings}
							network={workspace.network}
							buildingIndex={workspace.selectedBuildingIndex}
						/>
					{/if}
					<ComparisonPanel oncompare={runComparison} running={comparisonRunning} />
				{:else if workspace.activeTab === 'api'}
					<FirePanel
						waterArrival={workspace.waterArrival}
						workerReady={fireClient.ready}
						onretry={retryWithDefaultParameters}
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
						onfocus={(item) => {
							focusMapOn(item.position);
							if (item.kind === 'wideningSegment' && item.targetEdgeId !== null) {
								workspace.selectSegment(item.targetEdgeId);
							}
						}}
						onrun={runOptimizer}
						onapply={applyOptimizerResult}
						onprobe={runBatchProbe}
					/>
				{/if}
			{:else if dataset.status !== 'error'}
				<PanelSkeleton label="Memuat panel wilayah kerja" rows={4} />
				<PanelSkeleton label="Memuat klasifikasi gang" rows={5} />
			{/if}
		</div>

		{#if dataset.meta}
			<DataNotice meta={dataset.meta} />
		{/if}
	</aside>
</div>
