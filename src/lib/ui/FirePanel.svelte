<script lang="ts">
	import {
		BUILDING_STATE_LABEL,
		BUILDING_STATE_RGB,
		FIRE_MILESTONE_BUILDING_COUNT,
		MAX_WIND_SPEED_METERS_PER_SECOND
	} from '$lib/domain/constants';
	import { formatCount, formatSeconds } from '$lib/format';
	import type { FireStepSummary, WaterArrivalField } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';
	import WindDial from '$lib/ui/WindDial.svelte';
	import { PESAN_GAGAL_SIMULASI } from '$lib/ui/istilah';
	import { workspace } from '$lib/workspace.svelte';

	interface Props {
		waterArrival: WaterArrivalField | null;
		workerReady: boolean;
		onrun: () => void;
		onretry: () => void;
		onreset: () => void;
		buildingCount: number;
	}

	let { waterArrival, workerReady, onrun, onretry, onreset, buildingCount }: Props = $props();

	const failure = $derived(workspace.simulationFailure);

	const playback = $derived(workspace.playback);
	const summary = $derived<FireStepSummary | null>(workspace.currentFireSummary);
	const stateRows = [1, 2, 3, 4];

	function rgbToCss(code: number): string {
		const rgb = BUILDING_STATE_RGB[code];
		return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
	}

	function togglePlay(): void {
		workspace.playback = { ...playback, playing: !playback.playing };
	}

	function scrub(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		workspace.playback = {
			...playback,
			currentStep: Number(target.value),
			playing: false
		};
	}
</script>

<PanelSection
	title="Titik api awal"
	note="Klik bangunan di peta saat mode titik api aktif untuk menyalakan atau membatalkan."
>
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class={workspace.settingIgnition ? 'field-button-solid' : 'field-button'}
			onclick={() => (workspace.settingIgnition = !workspace.settingIgnition)}
		>
			{workspace.settingIgnition ? 'Mode titik api aktif' : 'Tetapkan titik api'}
		</button>
		<button
			type="button"
			class="field-button"
			disabled={workspace.ignitionBuildingIndices.length === 0}
			onclick={() => (workspace.ignitionBuildingIndices = [])}
		>
			Kosongkan
		</button>
	</div>
	<div class="mt-3">
		<ValueRow
			label="Bangunan menyala di awal"
			value={formatCount(workspace.ignitionBuildingIndices.length)}
			tone={workspace.ignitionBuildingIndices.length === 0 ? 'graphite' : 'alarm'}
		/>
	</div>
</PanelSection>

<PanelSection title="Angin">
	<div class="flex items-center gap-4">
		<WindDial
			directionDegrees={workspace.wind.directionDegrees}
			speedMetersPerSecond={workspace.wind.speedMetersPerSecond}
		/>
		<div class="flex-1">
			<label class="block">
				<span class="field-label-sm text-graphite">Arah tiup</span>
				<input
					class="mt-1.5 w-full"
					type="range"
					min="0"
					max="359"
					step="1"
					value={workspace.wind.directionDegrees}
					oninput={(event) =>
						(workspace.wind = {
							...workspace.wind,
							directionDegrees: Number(event.currentTarget.value)
						})}
				/>
			</label>
			<label class="mt-2 block">
				<span class="field-label-sm text-graphite">Kecepatan</span>
				<input
					class="mt-1.5 w-full"
					type="range"
					min="0"
					max={MAX_WIND_SPEED_METERS_PER_SECOND}
					step="0.5"
					value={workspace.wind.speedMetersPerSecond}
					oninput={(event) =>
						(workspace.wind = {
							...workspace.wind,
							speedMetersPerSecond: Number(event.currentTarget.value)
						})}
				/>
			</label>
		</div>
	</div>
	<div class="mt-2">
		<ValueRow label="Arah" value={`${Math.round(workspace.wind.directionDegrees)}°`} />
		<ValueRow measured
			label="Kecepatan"
			value={`${workspace.wind.speedMetersPerSecond.toFixed(1)} m/s`}
		/>
	</div>
</PanelSection>

<PanelSection title="Kendali simulasi">
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="field-button-solid"
			disabled={workspace.ignitionBuildingIndices.length === 0 || playback.running || !workerReady}
			onclick={onrun}
		>
			{playback.running ? 'Menghitung' : 'Jalankan'}
		</button>
		<button
			type="button"
			class="field-button"
			disabled={playback.snapshots.length === 0}
			onclick={togglePlay}
		>
			{playback.playing ? 'Jeda' : 'Putar'}
		</button>
		<button type="button" class="field-button" onclick={onreset}>Ulang</button>
	</div>

	{#if !workerReady}
		<p class="text-graphite mt-2.5 text-[11.5px] leading-[1.5]">
			Menyiapkan mesin simulasi dan data jarak antarbangunan. Tombol Jalankan aktif setelah keduanya
			siap.
		</p>
	{:else if workspace.ignitionBuildingIndices.length === 0}
		<p class="text-graphite mt-2.5 text-[11.5px] leading-[1.5]">
			Tetapkan minimal satu titik api lebih dulu, lalu tekan Jalankan.
		</p>
	{/if}

	{#if failure && failure.task === 'run'}
		<div class="border-alarm mt-3 border-l-4 py-1 pl-3" role="alert">
			<p class="text-ink text-[12px] leading-[1.55]">{PESAN_GAGAL_SIMULASI[failure.cause]}</p>
			<button type="button" class="field-button mt-2.5" onclick={onretry}>
				Ulangi dengan parameter awal
			</button>
		</div>
	{/if}

	<label class="mt-3 block">
		<span class="field-label-sm text-graphite">
			Waktu simulasi {summary ? formatSeconds(summary.elapsedSeconds) : '—'}
		</span>
		<input
			class="mt-1.5 w-full"
			type="range"
			min="0"
			max={Math.max(0, playback.snapshots.length - 1)}
			step="1"
			value={playback.currentStep}
			oninput={scrub}
			disabled={playback.snapshots.length === 0}
		/>
	</label>

	<label class="mt-2 flex items-center gap-2">
		<input
			type="checkbox"
			checked={workspace.suppressionEnabled}
			onchange={(event) => (workspace.suppressionEnabled = event.currentTarget.checked)}
		/>
		<span class="text-ink text-[11.5px]">Aktifkan pemadaman oleh unit yang datang</span>
	</label>
</PanelSection>

<PanelSection title="Hasil simulasi">
	{#if !summary}
		<p class="text-graphite text-[11.5px] leading-[1.55]">
			Belum ada simulasi. Tetapkan titik api, lalu tekan Jalankan.
		</p>
	{:else}
		<div class="mb-3 grid grid-cols-3 gap-px">
			<div class="hairline-box bg-paper px-2 py-2">
				<p class="field-label-sm text-graphite">Terbakar</p>
				<p class="readout-lg text-alarm mt-1.5">{formatCount(summary.burntCount)}</p>
			</div>
			<div class="hairline-box bg-paper px-2 py-2">
				<p class="field-label-sm text-graphite">Terselamatkan</p>
				<p class="readout-lg text-water mt-1.5">{formatCount(summary.savedCount)}</p>
			</div>
			<div class="hairline-box bg-paper px-2 py-2">
				<p class="field-label-sm text-graphite">Menyala</p>
				<p class="readout-lg text-ink mt-1.5">{formatCount(summary.burningCount)}</p>
			</div>
		</div>

		{#each stateRows as code (code)}
			<div class="ledger-row">
				<span class="flex items-center gap-2">
					<span class="h-[9px] w-[9px] shrink-0" style:background-color={rgbToCss(code)}></span>
					<span class="text-graphite text-[11.5px]">{BUILDING_STATE_LABEL[code]}</span>
				</span>
				<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
				<span class="readout text-ink">
					{formatCount(
						code === 1
							? summary.burningCount
							: code === 3
								? summary.burntCount
								: code === 4
									? summary.savedCount
									: 0
					)}
				</span>
			</div>
		{/each}

		<div class="bg-ink/15 my-2 h-px"></div>
		<ValueRow measured
			label={`Waktu sampai ${FIRE_MILESTONE_BUILDING_COUNT} bangunan`}
			value={formatSeconds(playback.secondsToTenBuildings)}
		/>
		<ValueRow label="Bangunan utuh" value={formatCount(summary.intactCount)} />
		<ValueRow label="Total bangunan" value={formatCount(buildingCount)} tone="graphite" />
		{#if waterArrival}
			<ValueRow measured
				label="Waktu air sampai rata-rata"
				value={formatSeconds(waterArrival.meanSecondsReachable)}
				tone="water"
			/>
			<ValueRow measured
				label="Waktu air sampai terburuk"
				value={formatSeconds(waterArrival.worstSecondsReachable)}
				tone="alarm"
			/>
		{/if}
	{/if}
</PanelSection>
