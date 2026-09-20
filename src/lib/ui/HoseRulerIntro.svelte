<script lang="ts">
	import { DEFAULT_MAX_HOSE_LENGTH_METERS, HOSE_ROLL_LENGTH_METERS } from '$lib/domain/constants';
	import { formatCount } from '$lib/format';

	const DURASI_GAMBAR_MILIDETIK = 1600;

	const totalGulung = DEFAULT_MAX_HOSE_LENGTH_METERS / HOSE_ROLL_LENGTH_METERS;
	const centang = Array.from({ length: totalGulung + 1 }, (_, index) => index);

	let meter = $state(DEFAULT_MAX_HOSE_LENGTH_METERS);

	$effect(() => {
		const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (kurangiGerak) {
			meter = DEFAULT_MAX_HOSE_LENGTH_METERS;
			return;
		}
		meter = 0;
		let bingkai = 0;
		let mulai = 0;
		const langkah = (waktu: number) => {
			if (!mulai) mulai = waktu;
			const bagian = Math.min(1, (waktu - mulai) / DURASI_GAMBAR_MILIDETIK);
			meter = Math.round(bagian * DEFAULT_MAX_HOSE_LENGTH_METERS);
			if (bagian < 1) bingkai = requestAnimationFrame(langkah);
		};
		bingkai = requestAnimationFrame(langkah);
		return () => cancelAnimationFrame(bingkai);
	});

	const bagianTergambar = $derived(meter / DEFAULT_MAX_HOSE_LENGTH_METERS);
	const gulung = $derived(Math.ceil(meter / HOSE_ROLL_LENGTH_METERS));
</script>

<div class="hairline-t hairline-b py-6">
	<div class="flex items-baseline justify-between gap-4">
		<p class="field-label-sm text-graphite">Selang digelar dari titik henti</p>
		<p class="field-label-sm text-graphite">
			Gulung <span class="readout text-ink" data-gulung-selang>{gulung}</span>/{totalGulung}
		</p>
	</div>

	<p class="readout-xl text-water mt-3" data-meter-selang>
		{formatCount(meter)}<span class="text-graphite text-[16px]"> m</span>
	</p>

	<div class="relative mt-3 h-8" aria-hidden="true">
		<div class="bg-ink/15 absolute top-3 left-0 h-[2px] w-full"></div>
		<div
			class="bg-water absolute top-3 left-0 h-[2px]"
			style:width={`${bagianTergambar * 100}%`}
		></div>
		{#each centang as tanda (tanda)}
			<div
				class="bg-ink/35 absolute top-0 h-3 w-px"
				style:left={`${(tanda / totalGulung) * 100}%`}
			></div>
		{/each}
	</div>

	<p class="text-graphite prose-measure mt-3 text-[13px] leading-[1.6]">
		Satu gulung selang panjangnya {HOSE_ROLL_LENGTH_METERS} meter, dan tiap centang di atas adalah satu
		gulung. Lembar kerja memakai {DEFAULT_MAX_HOSE_LENGTH_METERS} meter sebagai batas jangkauan dari satu
		sumber air. Di luar batas itu, air tidak sampai tanpa tambahan pompa atau sumber baru.
	</p>
</div>
