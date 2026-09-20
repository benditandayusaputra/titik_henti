<script lang="ts">
	import PageMeta from '$lib/ui/PageMeta.svelte';
	import { DATA_URL } from '$lib/data/sources';
	import { onMount } from 'svelte';
	import {
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_WIDTH_NOTE,
		DEFAULT_MAX_HOSE_LENGTH_METERS,
		WATER_SOURCE_LABEL
	} from '$lib/domain/constants';
	import { dataset } from '$lib/data/dataset.svelte';
	import DataUnavailable from '$lib/ui/DataUnavailable.svelte';
	import {
		buildPlanViewport,
		mergeAlleyPaths,
		measurePlanExtent,
		mergeBuildingPaths,
		projectPlanPoint,
		type PrintPlanDocument
	} from '$lib/data/printPlan';
	import {
		formatCount,
		formatDate,
		formatDecimal,
		formatKilometers,
		formatMeters,
		formatShare
	} from '$lib/format';
	import type { AccessClass, LonLat } from '$lib/domain/types';
	import { computeHoseReach } from '$lib/sim/hoseReach';
	import {
		collectStopPointCandidates,
		computeStopPointField,
		countHoseRolls
	} from '$lib/sim/stopPoint';

	const PLAN_WIDTH = 760;
	const PLAN_MAX_HEIGHT = 358;
	const STOP_POINT_ROW_LIMIT = 7;
	const POCKET_ROW_LIMIT = 5;
	const WATER_ROW_LIMIT = 5;
	const WRITE_LINE_COUNT = 4;

	let plan = $state.raw<PrintPlanDocument | null>(null);
	let planFailed = $state(false);

	function loadPrintPlan(): void {
		planFailed = false;
		void fetch(DATA_URL.printPlan)
			.then((response) => (response.ok ? response.json() : Promise.reject(new Error('print.json'))))
			.then((payload: PrintPlanDocument) => (plan = payload))
			.catch(() => (planFailed = true));
	}

	function reloadCard(): void {
		void dataset.load();
		loadPrintPlan();
	}

	onMount(() => {
		void dataset.load();
		loadPrintPlan();
	});

	const planHeight = $derived.by(() => {
		const document = plan;
		if (!document) return PLAN_MAX_HEIGHT;
		const extent = measurePlanExtent(document);
		const latitudeCosine = Math.cos((document.originLat * Math.PI) / 180);
		const aspect =
			((extent.maxX - extent.minX) * latitudeCosine) / Math.max(extent.maxY - extent.minY, 1);
		return Math.min(PLAN_MAX_HEIGHT, PLAN_WIDTH / aspect);
	});
	const viewport = $derived(plan ? buildPlanViewport(plan, PLAN_WIDTH, planHeight) : null);
	const buildingPath = $derived(plan && viewport ? mergeBuildingPaths(plan, viewport) : '');
	const boundaryPath = $derived.by(() => {
		const document = plan;
		const frame = viewport;
		if (!document || !frame) return '';
		return document.boundary
			.map((ring) => {
				const commands: string[] = [];
				for (let index = 0; index < ring.length; index += 2) {
					const [x, y] = projectPlanPoint(document, frame, ring[index], ring[index + 1]);
					commands.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
				}
				return `${commands.join(' ')} Z`;
			})
			.join(' ');
	});
	const alleyPaths = $derived.by<Record<AccessClass, string>>(() => {
		const document = plan;
		const frame = viewport;
		if (!document || !frame) return { largeUnit: '', smallUnit: '', hoseOnly: '' };
		return {
			largeUnit: mergeAlleyPaths(document, frame, 'largeUnit'),
			smallUnit: mergeAlleyPaths(document, frame, 'smallUnit'),
			hoseOnly: mergeAlleyPaths(document, frame, 'hoseOnly')
		};
	});

	interface StopPointRow {
		nodeId: number;
		position: LonLat;
		servedBuildingCount: number;
		farthestHoseMeters: number;
	}

	const stopPointRows = $derived.by<StopPointRow[]>(() => {
		const network = dataset.network;
		const buildings = dataset.buildings;
		if (!network || !buildings) return [];
		const field = computeStopPointField(network, collectStopPointCandidates(network));
		const served = new Map<number, { count: number; farthest: number }>();
		for (let index = 0; index < buildings.count; index += 1) {
			const entryNode = buildings.nearestNodeId[index];
			if (entryNode < 0) continue;
			const stopNode = field.stopNodeOfNode[entryNode];
			if (stopNode < 0 || !Number.isFinite(field.distanceMeters[entryNode])) continue;
			const hoseMeters =
				field.distanceMeters[entryNode] + buildings.nearestNodeDistanceMeters[index];
			const existing = served.get(stopNode);
			if (existing) {
				existing.count += 1;
				existing.farthest = Math.max(existing.farthest, hoseMeters);
			} else {
				served.set(stopNode, { count: 1, farthest: hoseMeters });
			}
		}
		return [...served.entries()]
			.map(([nodeId, detail]) => ({
				nodeId,
				position: { lon: network.nodeLon[nodeId], lat: network.nodeLat[nodeId] },
				servedBuildingCount: detail.count,
				farthestHoseMeters: detail.farthest
			}))
			.sort((first, second) => second.farthestHoseMeters - first.farthestHoseMeters)
			.slice(0, STOP_POINT_ROW_LIMIT);
	});

	const reach = $derived.by(() => {
		const network = dataset.network;
		const buildings = dataset.buildings;
		const adjacency = dataset.adjacency;
		if (!network || !buildings || !adjacency) return null;
		return computeHoseReach({
			network,
			buildings,
			adjacency,
			sourceNodeIds: dataset.waterSources.map((source) => source.nearestNodeId),
			maximumHoseLengthMeters: DEFAULT_MAX_HOSE_LENGTH_METERS
		});
	});

	const namedWaterSources = $derived(
		dataset.waterSources
			.filter((source) => source.kind !== 'applianceStand')
			.slice(0, WATER_ROW_LIMIT)
	);

	const writeLines = Array.from({ length: WRITE_LINE_COUNT }, (_, index) => index);
	const classOrder: AccessClass[] = ['largeUnit', 'smallUnit', 'hoseOnly'];
	const classStroke: Record<AccessClass, string> = {
		largeUnit: 'none',
		smallUnit: '5 3',
		hoseOnly: '1.5 2.5'
	};
	const classWidth: Record<AccessClass, number> = {
		largeUnit: 2.4,
		smallUnit: 1.5,
		hoseOnly: 1
	};

	function openPrintDialog(): void {
		window.print();
	}
</script>

<PageMeta
	title="Kartu siaga RT — Titik Henti"
	description="Kartu siaga RT satu halaman A4 hitam putih berisi titik henti, panjang selang, dan sumber air terdekat untuk ditempel di pos RT."
/>

<div class="bg-concrete flex-1 px-4 py-6 print:bg-white print:p-0">
	<div class="mx-auto mb-4 flex max-w-[210mm] items-start gap-4 print:hidden">
		<p class="text-graphite max-w-lg text-[11.5px] leading-[1.55]">
			Lembar ini dirancang untuk dicetak A4 potret hitam putih dan ditempel di pos RT. Kelas gang
			dibedakan dengan pola garis, bukan warna, supaya tetap terbaca setelah difotokopi.
		</p>
		<button type="button" class="field-button-solid ml-auto shrink-0" disabled={!dataset.meta} onclick={openPrintDialog}>
			Cetak lembar
		</button>
	</div>

	<article
		class="bg-paper mx-auto w-full max-w-[210mm] px-[11mm] py-[9mm] print:max-w-none print:bg-white print:px-0 print:py-0"
	>
		{#if dataset.meta}
			<header class="border-ink flex items-stretch gap-3 border-b-2 pb-2">
				<div class="flex-1">
					<p class="field-label-sm text-graphite">Pra-rencana kebakaran permukiman padat</p>
					<h1 class="font-display text-ink mt-1 text-[29px] leading-none font-semibold">
						Kartu siaga RT
					</h1>
					<p class="font-display text-ink mt-1.5 text-[14px] leading-none font-semibold">
						Kelurahan {dataset.meta.villageName}, Kecamatan {dataset.meta.districtName}, {dataset.meta
							.cityName}
					</p>
				</div>
				<div class="border-ink/25 flex w-[38mm] flex-col justify-between border-l pl-3 text-right">
					<div>
						<p class="field-label-sm text-graphite">Tanggal olah</p>
						<p class="field-label text-ink mt-1">
							{formatDate(dataset.meta.processedAt)}
						</p>
					</div>
					<div>
						<p class="field-label-sm text-graphite">Versi pipeline</p>
						<p class="field-label text-ink mt-1">v{dataset.meta.pipelineVersion}</p>
					</div>
				</div>
			</header>

			<section class="border-ink/25 grid grid-cols-2 gap-x-3 gap-y-2 border-b py-2 sm:grid-cols-4 print:grid-cols-4">
				<div>
					<p class="field-label-sm text-graphite">Bangunan</p>
					<p class="readout-lg text-ink mt-1">{formatCount(dataset.meta.buildingCount)}</p>
				</div>
				<div>
					<p class="field-label-sm text-graphite">Panjang gang</p>
					<p class="readout-lg text-ink mt-1">
						{formatKilometers(
							dataset.meta.alleyLengthMetersByClass.largeUnit +
								dataset.meta.alleyLengthMetersByClass.smallUnit +
								dataset.meta.alleyLengthMetersByClass.hoseOnly
						)}
					</p>
				</div>
				<div>
					<p class="field-label-sm text-graphite">Tak terlalui unit</p>
					<p class="readout-lg text-ink mt-1">
						{formatShare(dataset.meta.inaccessibleLengthShare)}
					</p>
				</div>
				<div>
					<p class="field-label-sm text-graphite">Tak terjangkau air</p>
					<p class="readout-lg text-ink mt-1">
						{reach ? formatCount(reach.unreachedBuildingCount) : '—'}
					</p>
				</div>
			</section>

			<section class="border-ink/25 border-b py-2.5">
				<div class="mb-1.5 flex items-baseline justify-between">
					<h2 class="field-label text-ink">01 Peta klasifikasi gang</h2>
					<p class="readout text-graphite text-[10px]">
						Selang maksimum {formatMeters(DEFAULT_MAX_HOSE_LENGTH_METERS)}
					</p>
				</div>
				{#if plan && viewport}
					<svg
						viewBox={`0 0 ${PLAN_WIDTH} ${planHeight}`}
						class="border-ink/30 w-full border"
						role="img"
						aria-label="Peta klasifikasi gang kelurahan"
					>
						<rect width={PLAN_WIDTH} height={planHeight} fill="#ffffff" />
						<path d={buildingPath} fill="#dcdcdc" stroke="#9a9a9a" stroke-width="0.3" />
						<path d={boundaryPath} fill="none" stroke="#1a1a1c" stroke-width="1.4" />
						{#each classOrder as accessClass (accessClass)}
							<path
								d={alleyPaths[accessClass]}
								fill="none"
								stroke="#1a1a1c"
								stroke-width={classWidth[accessClass]}
								stroke-dasharray={classStroke[accessClass]}
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						{/each}
					</svg>
					<ul class="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
						{#each classOrder as accessClass (accessClass)}
							<li class="flex items-center gap-2">
								<svg width="34" height="8" aria-hidden="true">
									<line
										x1="1"
										y1="4"
										x2="33"
										y2="4"
										stroke="#1a1a1c"
										stroke-width={classWidth[accessClass]}
										stroke-dasharray={classStroke[accessClass]}
									/>
								</svg>
								<span class="text-ink text-[10.5px]">
									{ACCESS_CLASS_LABEL[accessClass]}
									<span class="readout text-graphite ml-1 text-[9.5px]">
										{ACCESS_CLASS_WIDTH_NOTE[accessClass]}
									</span>
								</span>
							</li>
						{/each}
					</ul>
				{:else if planFailed}
					<p class="text-ink py-6 text-[11px] leading-[1.55]" role="alert">
						Gambar peta untuk kartu ini tidak berhasil diambil. Isi tabel di bawah tetap benar, tetapi
						sebaiknya muat ulang halaman sebelum mencetak supaya petanya ikut tercetak.
					</p>
				{:else}
					<div class="border-ink/20 flex h-[220px] w-full items-center border px-4" aria-busy="true">
						<p class="text-graphite text-[11px]" role="status">Menggambar peta kelurahan</p>
					</div>
				{/if}
			</section>

			<div class="border-ink/25 grid gap-x-6 gap-y-4 border-b py-2.5 sm:grid-cols-2 print:grid-cols-2">
				<section>
					<h2 class="field-label text-ink mb-1.5">02 Titik henti dan selang terjauh</h2>
					<table class="w-full">
						<thead>
							<tr class="border-ink/30 border-b">
								<th class="field-label-sm text-graphite py-1 text-left">Koordinat</th>
								<th class="field-label-sm text-graphite py-1 text-right">Selang</th>
								<th class="field-label-sm text-graphite py-1 text-right">Gulung</th>
							</tr>
						</thead>
						<tbody>
							{#each stopPointRows as row (row.nodeId)}
								<tr class="border-ink/15 border-b">
									<td class="readout text-ink py-[3px] text-[9.5px]">
										{row.position.lat.toFixed(5)}, {row.position.lon.toFixed(5)}
									</td>
									<td class="readout text-ink py-[3px] text-right text-[10px]">
										{Math.round(row.farthestHoseMeters)} m
									</td>
									<td class="readout text-ink py-[3px] text-right text-[10px]">
										{countHoseRolls(row.farthestHoseMeters)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>

				<section>
					<h2 class="field-label text-ink mb-1.5">03 Sumber air</h2>
					{#if namedWaterSources.length === 0}
						<p class="text-ink text-[10.5px] leading-[1.5]">
							Tidak ada hidran atau sumur terdata di OpenStreetMap untuk wilayah ini. Pasokan air
							bergantung pada tangki unit yang berhenti di titik henti tabel 02.
						</p>
					{:else}
						<table class="w-full">
							<thead>
								<tr class="border-ink/30 border-b">
									<th class="field-label-sm text-graphite py-1 text-left">Jenis</th>
									<th class="field-label-sm text-graphite py-1 text-left">Koordinat</th>
								</tr>
							</thead>
							<tbody>
								{#each namedWaterSources as source (source.id)}
									<tr class="border-ink/15 border-b">
										<td class="text-ink py-[3px] text-[10px]">
											{WATER_SOURCE_LABEL[source.kind]}
										</td>
										<td class="readout text-ink py-[3px] text-[9.5px]">
											{source.lat.toFixed(5)}, {source.lon.toFixed(5)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}

					<h2 class="field-label text-ink mt-2.5 mb-1.5">04 Kantong tak terjangkau</h2>
					{#if reach && reach.pockets.length > 0}
						<table class="w-full">
							<thead>
								<tr class="border-ink/30 border-b">
									<th class="field-label-sm text-graphite py-1 text-left">No</th>
									<th class="field-label-sm text-graphite py-1 text-left">Titik tengah</th>
									<th class="field-label-sm text-graphite py-1 text-right">Bangunan</th>
								</tr>
							</thead>
							<tbody>
								{#each reach.pockets.slice(0, POCKET_ROW_LIMIT) as pocket (pocket.id)}
									<tr class="border-ink/15 border-b">
										<td class="readout text-ink py-[3px] text-[10px]">
											{(pocket.id + 1).toString().padStart(2, '0')}
										</td>
										<td class="readout text-ink py-[3px] text-[9.5px]">
											{pocket.centroid.lat.toFixed(5)}, {pocket.centroid.lon.toFixed(5)}
										</td>
										<td class="readout text-ink py-[3px] text-right text-[10px]">
											{formatCount(pocket.buildingCount)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<p class="text-ink text-[10.5px]">Seluruh bangunan terjangkau pada selang maksimum.</p>
					{/if}
				</section>
			</div>

			<section class="border-ink/25 grid gap-x-5 gap-y-3 border-b py-2.5 sm:grid-cols-3 print:grid-cols-3">
				<div>
					<h2 class="field-label text-ink mb-1.5">05 Kontak RT</h2>
					{#each writeLines as line (line)}
						<div class="write-line"></div>
					{/each}
				</div>
				<div>
					<h2 class="field-label text-ink mb-1.5">06 Posisi APAR</h2>
					{#each writeLines as line (line)}
						<div class="write-line"></div>
					{/each}
				</div>
				<div>
					<h2 class="field-label text-ink mb-1.5">07 Perlu bantuan evakuasi</h2>
					{#each writeLines as line (line)}
						<div class="write-line"></div>
					{/each}
				</div>
			</section>

			<footer class="pt-1.5">
				<p class="text-graphite text-[8.5px] leading-[1.5]">
					Sumber data: tapak bangunan Google Open Buildings V3 (CC BY 4.0); jaringan jalan,
					sumber air, dan batas kelurahan dari OpenStreetMap (ODbL 1.0). Lebar gang pada lembar ini
					adalah estimasi citra satelit yang dihitung pada grid {formatDecimal(
						dataset.meta.rasterResolutionMeters,
						1
					)} meter per piksel, bukan hasil ukur lapangan, dan wajib
					diverifikasi langsung sebelum dipakai sebagai dasar keputusan operasional. Tinggi dan
					kelas material bangunan sebagian diperkirakan dari luas tapak. Titik henti pada tabel 02
					adalah simpul jaringan yang masih dapat dilalui unit besar, bukan pos parkir resmi.
				</p>
			</footer>
		{:else if dataset.status === 'error'}
			<div class="py-10 print:hidden">
				<h1 class="font-display text-ink mb-5 text-[29px] leading-none font-semibold">Kartu siaga RT</h1>
				<DataUnavailable onretry={reloadCard} />
			</div>
		{:else}
			<div class="py-10" aria-busy="true">
				<h1 class="font-display text-ink mb-3 text-[29px] leading-none font-semibold">Kartu siaga RT</h1>
				<p class="text-ink text-[13px] leading-[1.55]" role="status">Menyusun kartu siaga RT</p>
				<p class="text-graphite prose-measure mt-1.5 text-[12px] leading-[1.55]">
					Data titik henti, sumber air, dan kantong tak terjangkau sedang diambil. Tombol cetak aktif
					setelah kartu selesai disusun.
				</p>
			</div>
		{/if}
	</article>
</div>

<style>
	@media print {
		@page {
			size: A4 portrait;
			margin: 8mm;
		}

		article {
			width: 194mm;
			max-height: 281mm;
			overflow: hidden;
		}

		article {
			break-inside: avoid;
		}

		section,
		table,
		tr,
		footer,
		header,
		svg {
			break-inside: avoid;
		}
	}
</style>
