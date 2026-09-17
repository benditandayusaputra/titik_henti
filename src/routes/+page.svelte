<script lang="ts">
	import PageMeta from '$lib/ui/PageMeta.svelte';
	import {
		ACCESS_CLASS_COLOR,
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_WIDTH_NOTE,
		HOSE_ROLL_LENGTH_METERS,
		LARGE_UNIT_MIN_WIDTH_METERS
	} from '$lib/domain/constants';
	import { pipelineMeta as meta } from '$lib/data/sources';
	import { formatCount, formatDecimal, formatKilometers, formatShare } from '$lib/format';
	import type { AccessClass } from '$lib/domain/types';

	const classes: AccessClass[] = ['largeUnit', 'smallUnit', 'hoseOnly'];
	const chain = [
		'Lebar gang',
		'Kelas akses segmen',
		'Sampai mana kendaraan masuk',
		'Posisi titik henti',
		'Panjang selang digelar',
		'Waktu air sampai',
		'Kapan pemadaman bekerja',
		'Berapa bangunan terbakar'
	];
</script>

<PageMeta
	title="Titik Henti — perencanaan siaga kebakaran gang"
	description="Titik Henti memetakan lebar gang permukiman padat dan menghitung akibatnya terhadap waktu air sampai serta luas kebakaran."
/>

<section class="sheet-grid hairline-b px-5 pt-14 pb-16 sm:px-10">
	<div class="measure-rail mx-auto w-full max-w-5xl">
		<div class="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-14">
			<h1
				class="font-display text-ink shrink-0 text-[clamp(3.2rem,11vw,8rem)] leading-[0.84] font-semibold tracking-[-0.015em]"
			>
				Titik<br />henti
			</h1>
			<p class="text-ink prose-measure max-w-md pb-2 text-[15.5px] leading-[1.62]">
				Di permukiman padat, mobil pemadam berhenti jauh sebelum sampai ke titik api. Dari situ
				selang digelar dengan tangan. Setiap meter selang adalah tambahan detik sebelum air
				sampai, dan setiap detik itu adalah rumah berikutnya yang ikut terbakar.
			</p>
		</div>

		<div class="bg-ink mt-10 h-[2px] w-full"></div>

		<dl class="mt-8 grid grid-cols-2 gap-px md:grid-cols-4">
			<div class="hairline-box bg-paper crop-mark relative px-4 py-4">
				<dt class="field-label-sm text-graphite">Wilayah uji</dt>
				<dd class="font-display text-ink mt-2 text-[22px] leading-none font-semibold">
					{meta.villageName}
				</dd>
				<dd class="field-label-sm text-graphite mt-2">
					Luas {formatDecimal(meta.areaSquareKilometres, 2)} km persegi
				</dd>
				<dd class="field-label-sm text-graphite mt-1">
					Penduduk {formatCount(meta.populationCount)} jiwa
				</dd>
			</div>
			<div class="hairline-box bg-paper px-4 py-4">
				<dt class="field-label-sm text-graphite">Bangunan terpetakan</dt>
				<dd class="readout-xl text-ink mt-2">{formatCount(meta.buildingCount)}</dd>
			</div>
			<div class="hairline-box bg-paper px-4 py-4">
				<dt class="field-label-sm text-graphite">Jaringan gang</dt>
				<dd class="readout-xl text-ink mt-2">
					{formatKilometers(
						meta.alleyLengthMetersByClass.largeUnit +
							meta.alleyLengthMetersByClass.smallUnit +
							meta.alleyLengthMetersByClass.hoseOnly
					)}
				</dd>
			</div>
			<div class="hairline-box bg-paper px-4 py-4">
				<dt class="field-label-sm text-graphite">Tak terlalui kendaraan</dt>
				<dd class="readout-xl text-alarm mt-2">
					{formatShare(meta.inaccessibleLengthShare)}
				</dd>
			</div>
		</dl>

		<div class="mt-8 flex flex-wrap gap-2">
			<a href="/peta/" class="field-button-solid">Buka lembar kerja</a>
			<a href="/kartu/" class="field-button">Kartu siaga RT</a>
			<a href="/metode/" class="field-button">Metode dan sumber data</a>
		</div>
	</div>
</section>

<section class="hairline-b px-5 py-14 sm:px-10">
	<div class="mx-auto w-full max-w-5xl">
		<h2 class="font-display text-ink mb-6 text-[clamp(1.4rem,3vw,2rem)] leading-tight font-semibold">
			Ambang yang menentukan segalanya
		</h2>
		<div class="grid gap-px md:grid-cols-3">
			{#each classes as accessClass (accessClass)}
				<div class="hairline-box bg-paper px-5 py-5">
					<span
						class="border-ink/25 mb-4 block h-[5px] w-full border-y"
						style:background-color={ACCESS_CLASS_COLOR[accessClass]}
					></span>
					<p class="font-display text-ink text-[17px] leading-none font-semibold">
						{ACCESS_CLASS_LABEL[accessClass]}
					</p>
					<p class="readout-lg text-ink mt-3">{ACCESS_CLASS_WIDTH_NOTE[accessClass]}</p>
					<p class="field-label-sm text-graphite mt-3">
						{formatKilometers(meta.alleyLengthMetersByClass[accessClass])} di kelurahan uji
					</p>
				</div>
			{/each}
		</div>
		<p class="text-graphite prose-measure mt-5 text-[12.5px] leading-[1.6]">
			Ambang {formatDecimal(LARGE_UNIT_MIN_WIDTH_METERS, 1)} meter dipakai karena di bawah itu unit
			pemadam berukuran penuh tidak dapat lewat. Satu gulung selang panjangnya {HOSE_ROLL_LENGTH_METERS}
			meter, dan jumlah gulung yang harus digelar adalah ukuran paling jujur dari seberapa jauh
			sebuah rumah dari air.
		</p>
	</div>
</section>

<section class="bg-ink px-5 py-14 sm:px-10">
	<div class="mx-auto w-full max-w-5xl">
		<h2 class="font-display text-concrete mb-7 text-[clamp(1.4rem,3vw,2rem)] leading-tight font-semibold">
			Rantai sebab akibat di dalam kode
		</h2>
		<ol class="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
			{#each chain as step, index (step)}
				<li class="border-concrete/20 bg-ink-deep border px-4 py-4">
					<span class="readout text-graphite-pale text-[11px]">
						{(index + 1).toString().padStart(2, '0')}
					</span>
					<p class="text-concrete mt-2 text-[13px] leading-[1.45]">{step}</p>
				</li>
			{/each}
		</ol>
		<p class="text-graphite-pale prose-measure mt-6 text-[12.5px] leading-[1.6]">
			Setiap tautan pada rantai ini dihitung, bukan dinarasikan. Kontrol
			<span class="text-concrete">naikkan semua gang satu kelas</span> di lembar kerja menjalankan ulang
			seluruh rantai dengan benih acak yang sama persis, sehingga selisih jumlah bangunan terbakar
			benar-benar berasal dari perubahan jaringan gang.
		</p>
	</div>
</section>
