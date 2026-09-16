<script lang="ts">
	import {
		FIRE_COEFFICIENT_LABEL,
		FIRE_COEFFICIENT_RANGE,
		FIRE_COEFFICIENT_UNIT
	} from '$lib/domain/constants';
	import type { FireCoefficients } from '$lib/domain/types';
	import { workspace } from '$lib/workspace.svelte';

	const keys = Object.keys(FIRE_COEFFICIENT_LABEL) as (keyof FireCoefficients)[];

	function updateCoefficient(key: keyof FireCoefficients, value: number): void {
		workspace.coefficients = { ...workspace.coefficients, [key]: value };
	}

	function formatValue(key: keyof FireCoefficients): string {
		const value = workspace.coefficients[key];
		const step = FIRE_COEFFICIENT_RANGE[key][2];
		const decimals = step >= 1 ? 0 : step >= 0.01 ? 2 : 4;
		return `${value.toFixed(decimals)}${FIRE_COEFFICIENT_UNIT[key]}`;
	}
</script>

<section class="hairline-b">
	<button
		type="button"
		class="hover:bg-concrete-tint flex w-full items-center gap-2 px-4 py-3 text-left"
		onclick={() => (workspace.calibrationOpen = !workspace.calibrationOpen)}
		aria-expanded={workspace.calibrationOpen}
	>
		<span class="readout text-graphite-pale text-[11px]">D5</span>
		<span class="bg-ink/25 h-px flex-1"></span>
		<span class="stencil text-ink">Kalibrasi koefisien</span>
		<span class="readout text-graphite text-[13px]">{workspace.calibrationOpen ? '−' : '+'}</span>
	</button>

	{#if workspace.calibrationOpen}
		<div class="px-4 pb-4">
			<p class="text-graphite mb-3 text-[11px] leading-[1.5]">
				Koefisien mengikuti bentuk model kebakaran kota berbasis fisika Himoto dan Tanaka,
				disederhanakan menjadi suku radiasi, angin, material, dan percikan bara. Ubah di sini bila
				laju penjalaran tidak masuk akal, jangan mengubah kode.
			</p>
			<div class="flex flex-col gap-2.5">
				{#each keys as key (key)}
					{@const range = FIRE_COEFFICIENT_RANGE[key]}
					<label class="block">
						<span class="flex items-baseline justify-between gap-2">
							<span class="text-graphite text-[11px] leading-tight">
								{FIRE_COEFFICIENT_LABEL[key]}
							</span>
							<span class="readout text-ink text-[11px]">{formatValue(key)}</span>
						</span>
						<input
							class="mt-1 w-full"
							type="range"
							min={range[0]}
							max={range[1]}
							step={range[2]}
							value={workspace.coefficients[key]}
							oninput={(event) => updateCoefficient(key, Number(event.currentTarget.value))}
						/>
					</label>
				{/each}
			</div>
			<button type="button" class="field-button mt-3" onclick={() => workspace.resetCoefficients()}>
				Kembalikan nilai bawaan
			</button>
		</div>
	{/if}
</section>
