<script lang="ts">
	import {
		ACCESS_CLASS_LABEL,
		APPLIANCE_TURNOUT_SECONDS,
		GOOGLE_MAPS_DIRECTIONS_URL,
		HOSE_ROLL_LENGTH_METERS
	} from '$lib/domain/constants';
	import { formatCoordinate, formatMeters, formatSeconds } from '$lib/format';
	import type { StopPointSolution } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';

	interface Props {
		solution: StopPointSolution | null;
		drawnMeters: number;
	}

	let { solution, drawnMeters }: Props = $props();

	const drawnRolls = $derived(
		solution ? Math.min(solution.hoseRollCount, Math.ceil(drawnMeters / HOSE_ROLL_LENGTH_METERS)) : 0
	);

	const teksKoordinat = $derived(
		solution ? formatCoordinate(solution.stopPoint.lon, solution.stopPoint.lat) : ''
	);
	const tautanNavigasi = $derived(GOOGLE_MAPS_DIRECTIONS_URL + teksKoordinat.replace(' ', ''));

	let simpulKoordinat = $state<HTMLSpanElement | undefined>();
	let pesanSalin = $state('');

	async function salinKoordinat(): Promise<void> {
		try {
			await navigator.clipboard.writeText(teksKoordinat);
			pesanSalin = 'Koordinat disalin.';
		} catch {
			if (simpulKoordinat) getSelection()?.selectAllChildren(simpulKoordinat);
			pesanSalin = 'Papan klip tidak tersedia. Koordinat sudah disorot, tekan Ctrl+C.';
		}
	}
</script>

<PanelSection
	title="Titik henti kendaraan"
	note="Simpul terdekat pada segmen yang masih bisa dilalui unit besar."
>
	{#if !solution}
		<p class="text-graphite text-[11.5px] leading-[1.55]">
			Ketuk rumah yang terbakar di peta. Lembar ini mencari titik berhenti mobil pemadam terdekat
			yang masih bisa dicapai kendaraan, mengukur panjang selang dari sana, dan memberi koordinat
			yang bisa dikirim ke sopir lewat Google Maps.
		</p>
	{:else if !solution.reachable}
		<p class="text-alarm text-[12px] leading-[1.55]">
			Tidak ada segmen kelas unit besar yang terhubung ke bangunan ini. Mobil pemadam tidak punya
			titik henti yang sah, dan air hanya bisa datang lewat sumber lain.
		</p>
	{:else}
		<div class="mb-3">
			<div class="flex items-end justify-between gap-3">
				<span class="field-label text-graphite">Panjang selang</span>
				<span class="field-label text-graphite">Gulung</span>
			</div>
			<div class="mt-1 flex items-end justify-between gap-3">
				<span class="readout-xl text-water">
					{formatMeters(Math.round(drawnMeters))}
				</span>
				<span class="readout-lg text-ink">
					{drawnRolls}<span class="text-graphite text-[15px]">/{solution.hoseRollCount}</span>
				</span>
			</div>
			<div class="mt-2 flex gap-[3px]">
				{#each Array.from({ length: solution.hoseRollCount }, (_, index) => index) as roll (roll)}
					<span
						class="h-[9px] flex-1"
						style:background-color={roll < drawnRolls ? '#0F7C8A' : 'rgba(110,110,115,0.28)'}
					></span>
				{/each}
			</div>
		</div>

		<div class="ledger-row">
			<span class="text-graphite shrink-0 text-[11.5px] leading-tight">Koordinat titik henti</span>
			<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
			<span class="readout text-ink shrink-0" bind:this={simpulKoordinat}>{teksKoordinat}</span>
		</div>
		<div class="mt-2 flex flex-wrap gap-2">
			<a
				class="field-button-solid"
				href={tautanNavigasi}
				target="_blank"
				rel="noreferrer"
			>
				Buka di Google Maps
			</a>
			<button type="button" class="field-button" onclick={salinKoordinat}>Salin koordinat</button>
		</div>
		{#if pesanSalin}
			<p class="field-label-sm text-graphite mt-2" role="status" aria-live="polite">{pesanSalin}</p>
		{/if}

		<ValueRow measured
			label="Tambahan waktu sebelum air sampai"
			value={formatSeconds(solution.extraDelaySeconds)}
			tone="alarm"
			emphasis
		/>
		<ValueRow measured
			label="Termasuk penyiapan unit"
			value={formatSeconds(APPLIANCE_TURNOUT_SECONDS)}
			tone="graphite"
		/>
		<ValueRow
			label="Kelas penghambat"
			value={solution.blockingAccessClass
				? ACCESS_CLASS_LABEL[solution.blockingAccessClass]
				: 'Tidak ada'}
			tone={solution.blockingAccessClass ? 'caution' : 'ink'}
		/>
		{#if solution.blockingAccessClass}
			<p class="text-graphite mt-2 text-[11px] leading-[1.55]">
				Kendaraan berhenti di sini karena segmen berikutnya berkelas
				<span class="text-ink font-medium"
					>{ACCESS_CLASS_LABEL[solution.blockingAccessClass].toLowerCase()}</span
				>. Sisa jarak ditempuh dengan menggelar selang secara manual.
			</p>
		{/if}
	{/if}
</PanelSection>
