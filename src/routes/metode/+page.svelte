<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ADJACENCY_RADIUS_METERS,
		APPLIANCE_TURNOUT_SECONDS,
		CREW_APPROACH_SPEED_METERS_PER_SECOND,
		DEFAULT_FIRE_COEFFICIENTS,
		FIRE_COEFFICIENT_LABEL,
		FIRE_COEFFICIENT_UNIT,
		FIRE_STEP_SECONDS,
		HOSE_COUPLING_SECONDS_PER_JOINT,
		HOSE_DEPLOY_SECONDS_PER_ROLL,
		HOSE_ROLL_LENGTH_METERS,
		LARGE_UNIT_MIN_WIDTH_METERS,
		SMALL_UNIT_MIN_WIDTH_METERS
	} from '$lib/domain/constants';
	import { dataset } from '$lib/data/dataset.svelte';
	import { formatDate, formatDecimal } from '$lib/format';
	import type { FireCoefficients } from '$lib/domain/types';

	onMount(() => {
		void dataset.load();
	});

	const coefficientKeys = Object.keys(FIRE_COEFFICIENT_LABEL) as (keyof FireCoefficients)[];

	const pipelineStages = [
		{
			index: '01',
			title: 'Ingest',
			body: 'Footprint bangunan Google Open Buildings V3 diambil dari sel S2 level 6 yang memuat bounding box kelurahan, lalu disaring per baris dengan ambang kepercayaan. Jaringan jalan, sumber air, batas kelurahan, dan tag tinggi bangunan diambil dari OpenStreetMap lewat Overpass.'
		},
		{
			index: '02',
			title: 'Rasterisasi dan rangka',
			body: `Union footprint bangunan dan badan air dirasterisasi pada grid ${0.5} meter per piksel. Ruang terbuka adalah komplemen raster penghalang di dalam batas area. Distance transform pada ruang terbuka memberi jarak ke penghalang terdekat, dan skeletonize memberi garis tengah. Lebar pada tiap piksel rangka adalah dua kali nilai distance transform.`
		},
		{
			index: '03',
			title: 'Vektorisasi dan klasifikasi',
			body: `Rangka ditelusuri menjadi lintasan, dipecah di persimpangan, dan cabang lebih pendek dari ambang dipangkas sebelum disederhanakan. Lebar minimum tiap segmen diambil dari profil lebar yang sudah dihaluskan median. Segmen dengan lebar minimum di atas ${formatDecimal(LARGE_UNIT_MIN_WIDTH_METERS, 1)} meter dapat dilalui unit besar, antara ${formatDecimal(SMALL_UNIT_MIN_WIDTH_METERS, 1)} dan ${formatDecimal(LARGE_UNIT_MIN_WIDTH_METERS, 1)} meter hanya unit kecil, di bawah itu hanya selang.`
		},
		{
			index: '04',
			title: 'Ketetanggaan bangunan',
			body: `Untuk tiap bangunan dicari seluruh bangunan lain dalam radius ${ADJACENCY_RADIUS_METERS} meter, dengan jarak diukur tepi ke tepi, bukan pusat ke pusat. Hasilnya ditulis sebagai daftar ketetanggaan biner berindeks integer supaya asset tetap ringan.`
		},
		{
			index: '05',
			title: 'Emit',
			body: 'Segmen gang dan footprint bangunan ditulis sebagai PMTiles, ketetanggaan dan atribut bangunan sebagai berkas biner, graf jaringan dan metadata sebagai JSON. Seluruh keluaran bersifat statis dan tidak memerlukan server.'
		}
	];

	const limitations = [
		'Lebar gang adalah estimasi dari citra satelit pada grid 0,5 meter. Kanopi, tenda, gerobak, dan parkir liar tidak terlihat, sehingga lebar efektif di lapangan hampir selalu lebih sempit dari angka di sini.',
		'Tinggi bangunan hanya terukur untuk bangunan yang punya tag tinggi atau jumlah lantai di OpenStreetMap. Sisanya diperkirakan dari luas tapak memakai rata-rata bucket yang dihitung dari subset terukur di wilayah yang sama.',
		'Kelas material diperkirakan dari luas tapak dan tinggi, bukan hasil survei. Tag building:material dipakai bila tersedia.',
		'Titik henti adalah simpul jaringan pada komponen kelas unit besar yang terhubung ke jalan bernama. Ini bukan pos parkir resmi dan tidak memperhitungkan radius putar kendaraan.',
		'Model penjalaran api memakai satu regu pemadam yang efektif di seluruh kelurahan secara bersamaan. Keterbatasan jumlah unit dan jumlah jalur selang belum dimodelkan, sehingga jumlah bangunan terselamatkan adalah batas atas yang optimistis.',
		'Koefisien model dikalibrasi agar laju penjalaran masuk akal untuk permukiman padat, bukan hasil pencocokan terhadap catatan kejadian nyata.'
	];
</script>

<svelte:head>
	<title>Metode dan sumber data — Titik Henti</title>
</svelte:head>

<div class="flex-1 px-5 py-12 sm:px-10">
	<div class="measure-rail mx-auto w-full max-w-4xl">
		<h1 class="font-display text-ink text-[clamp(2rem,6vw,3.4rem)] leading-[0.92] font-semibold">
			Bagaimana angka<br />di lembar ini dibuat
		</h1>
		<div class="bg-ink mt-6 mb-10 h-[2px] w-full"></div>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Pipeline data</h2>
			<ol class="flex flex-col">
				{#each pipelineStages as stage (stage.index)}
					<li class="hairline-b flex gap-4 py-4 last:border-b-0">
						<span class="readout text-graphite w-8 shrink-0 pt-[2px] text-[12px]">
							{stage.index}
						</span>
						<div class="min-w-0">
							<h3 class="font-display text-ink text-[15px] leading-none font-semibold">
								{stage.title}
							</h3>
							<p class="text-ink mt-2 text-[13px] leading-[1.6]">{stage.body}</p>
						</div>
					</li>
				{/each}
			</ol>
		</section>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Model waktu air sampai</h2>
			<div class="hairline-box bg-paper px-5 py-5">
				<p class="text-ink text-[13px] leading-[1.65]">
					Waktu air sampai di sebuah bangunan dihitung dari titik henti terdekat lewat jalur
					terpendek pada graf jaringan gang, dengan bobot panjang segmen. Panjang jalur itu diubah
					menjadi detik memakai asumsi yang disimpan di satu berkas konstanta.
				</p>
				<dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
					<div>
						<dt class="field-label-sm text-graphite">Satu gulung</dt>
						<dd class="readout text-ink mt-1.5">{HOSE_ROLL_LENGTH_METERS} m</dd>
					</div>
					<div>
						<dt class="field-label-sm text-graphite">Penyiapan unit</dt>
						<dd class="readout text-ink mt-1.5">{APPLIANCE_TURNOUT_SECONDS} s</dd>
					</div>
					<div>
						<dt class="field-label-sm text-graphite">Gelar per gulung</dt>
						<dd class="readout text-ink mt-1.5">{HOSE_DEPLOY_SECONDS_PER_ROLL} s</dd>
					</div>
					<div>
						<dt class="field-label-sm text-graphite">Sambung per kopling</dt>
						<dd class="readout text-ink mt-1.5">{HOSE_COUPLING_SECONDS_PER_JOINT} s</dd>
					</div>
					<div>
						<dt class="field-label-sm text-graphite">Laju regu</dt>
						<dd class="readout text-ink mt-1.5">
							{formatDecimal(CREW_APPROACH_SPEED_METERS_PER_SECOND, 2)} m/s
						</dd>
					</div>
					<div>
						<dt class="field-label-sm text-graphite">Langkah simulasi</dt>
						<dd class="readout text-ink mt-1.5">{FIRE_STEP_SECONDS} s</dd>
					</div>
				</dl>
			</div>
		</section>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Model penjalaran api</h2>
			<div class="hairline-box bg-paper px-5 py-5">
				<p class="text-ink text-[13px] leading-[1.65]">
					Cellular automata heterogen di atas graf ketetanggaan bangunan. Mekanismenya mengacu pada
					model berbasis fisika Himoto dan Tanaka untuk kebakaran perkotaan padat, disederhanakan
					menjadi tiga suku ditambah percikan bara.
				</p>
				<div class="hairline-box bg-paper mt-4 overflow-x-auto px-4 py-3">
					<p class="readout text-ink whitespace-nowrap">
						P(j) = 1 − Π<sub>i∈menyala</sub> (1 − p<sub>ij</sub>)
					</p>
					<p class="readout text-ink mt-2 whitespace-nowrap">
						p<sub>ij</sub> = radiasi(d, luas<sub>i</sub>, tinggi<sub>i</sub>) × angin(θ<sub
							>ij</sub
						>, arah, laju) × material<sub>j</sub> + bara(d, θ<sub>ij</sub>, arah)
					</p>
				</div>
				<p class="text-graphite mt-4 text-[12px] leading-[1.6]">
					Suku radiasi turun terhadap kuadrat jarak dan naik terhadap luas serta tinggi sumber.
					Suku angin memperbesar peluang searah angin dan memperkecil arah berlawanan. Suku
					material adalah faktor per kelas bangunan penerima. Suku percikan bara berpeluang kecil
					tetapi berjangkauan jauh dan hanya searah angin.
				</p>
			</div>

			<div class="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
				{#each coefficientKeys as key (key)}
					<div class="ledger-row">
						<span class="text-graphite text-[11.5px]">{FIRE_COEFFICIENT_LABEL[key]}</span>
						<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
						<span class="readout text-ink">
							{DEFAULT_FIRE_COEFFICIENTS[key]}{FIRE_COEFFICIENT_UNIT[key]}
						</span>
					</div>
				{/each}
			</div>
			<p class="text-graphite mt-3 text-[11.5px] leading-[1.55]">
				Seluruh koefisien dapat diubah dari panel kalibrasi di lembar kerja tanpa mengubah kode.
			</p>
		</section>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Sumber data dan lisensi</h2>
			{#if dataset.meta}
				<table class="w-full">
					<thead>
						<tr class="border-ink/30 border-b">
							<th class="field-label-sm text-graphite py-2 text-left">Lapisan</th>
							<th class="field-label-sm text-graphite py-2 text-left">Sumber</th>
							<th class="field-label-sm text-graphite py-2 text-right">Lisensi</th>
						</tr>
					</thead>
					<tbody>
						{#each dataset.meta.provenance as source (source.label)}
							<tr class="hairline-b">
								<td class="text-ink py-2 pr-3 text-[12px]">{source.label}</td>
								<td class="text-graphite py-2 pr-3 text-[11.5px] leading-[1.45]">
									{source.source}
								</td>
								<td class="readout text-ink py-2 text-right text-[11px]">{source.licence}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="field-label-sm text-graphite mt-3">
					Tanggal olah {formatDate(dataset.meta.processedAt)}, pipeline versi {dataset.meta
						.pipelineVersion}
				</p>
			{/if}
		</section>

		<section class="mb-4">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Batasan yang harus dibaca lebih dulu</h2>
			<ul class="flex flex-col">
				{#each limitations as limitation, index (limitation)}
					<li class="hairline-b flex gap-3 py-3 last:border-b-0">
						<span class="readout text-alarm w-6 shrink-0 pt-[2px] text-[12px]">
							{(index + 1).toString().padStart(2, '0')}
						</span>
						<p class="text-ink text-[12.5px] leading-[1.6]">{limitation}</p>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
