<script lang="ts">
	import PageMeta from '$lib/ui/PageMeta.svelte';
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
	import { pipelineMeta as meta } from '$lib/data/sources';
	import { formatCount, formatDate, formatDecimal, formatMeters } from '$lib/format';
	import type { FireCoefficients } from '$lib/domain/types';
	import {
		FIELD_MEASUREMENTS,
		FIELD_MEASUREMENT_TARGET_COUNT,
		OSM_WIDTH_CHECK,
		FIELD_MEASUREMENT_TOLERANCE_METERS,
		SYNTHETIC_BUILDING_COUNT,
		SYNTHETIC_RASTER_RESOLUTION_METERS,
		SYNTHETIC_SEGMENT_COUNT,
		SYNTHETIC_TOTAL_LENGTH_METERS,
		SYNTHETIC_WIDTH_CHECKS,
		countFieldMeasurementsWithinTolerance,
		findLargestSyntheticError,
		measureAbsoluteError,
		measureFieldError,
		roundShareToTenths
	} from '$lib/domain/validation';

	const coefficientKeys = Object.keys(FIRE_COEFFICIENT_LABEL) as (keyof FireCoefficients)[];

	const pipelineStages = [
		{
			index: '01',
			title: 'Pengambilan data',
			body: 'Tapak bangunan Google Open Buildings V3 diambil dari sel S2 level 6 yang memuat bounding box kelurahan, lalu disaring per baris dengan ambang kepercayaan. Jaringan jalan, sumber air, batas kelurahan, dan tag tinggi bangunan diambil dari OpenStreetMap lewat Overpass.'
		},
		{
			index: '02',
			title: 'Rasterisasi dan rangka',
			body: `Gabungan tapak bangunan dan badan air dirasterisasi pada grid ${0.5} meter per piksel. Ruang terbuka adalah komplemen raster penghalang di dalam batas area. Distance transform pada ruang terbuka memberi jarak ke penghalang terdekat, dan skeletonize memberi garis tengah. Lebar pada tiap piksel rangka adalah dua kali nilai distance transform.`
		},
		{
			index: '03',
			title: 'Vektorisasi dan klasifikasi',
			body: `Rangka ditelusuri menjadi lintasan, dipecah di persimpangan, dan cabang lebih pendek dari ambang dipangkas sebelum disederhanakan. Lebar minimum tiap segmen diambil dari profil lebar yang sudah dihaluskan median. Segmen dengan lebar minimum di atas ${formatDecimal(LARGE_UNIT_MIN_WIDTH_METERS, 1)} meter dapat dilalui unit besar, antara ${formatDecimal(SMALL_UNIT_MIN_WIDTH_METERS, 1)} dan ${formatDecimal(LARGE_UNIT_MIN_WIDTH_METERS, 1)} meter hanya unit kecil, di bawah itu hanya selang.`
		},
		{
			index: '04',
			title: 'Jarak antarbangunan',
			body: `Untuk tiap bangunan dicari seluruh bangunan lain dalam radius ${ADJACENCY_RADIUS_METERS} meter, dengan jarak diukur tepi ke tepi, bukan pusat ke pusat. Hasilnya ditulis sebagai daftar jarak antarbangunan dalam format biner berindeks bilangan bulat supaya aset tetap ringan.`
		},
		{
			index: '05',
			title: 'Penulisan keluaran',
			body: 'Segmen gang dan tapak bangunan ditulis sebagai PMTiles, jarak antarbangunan dan atribut bangunan sebagai berkas biner, graf jaringan dan metadata sebagai JSON. Seluruh keluaran bersifat statis dan tidak memerlukan server.'
		}
	];

	const largestSyntheticError = findLargestSyntheticError(SYNTHETIC_WIDTH_CHECKS);
	const fieldMeasurementsWithinTolerance =
		countFieldMeasurementsWithinTolerance(FIELD_MEASUREMENTS);

	const limitations = [
		'Lebar gang adalah estimasi dari citra satelit pada grid 0,5 meter, dan mengukur ruang bebas di antara tapak bangunan, bukan lebar badan jalan. Kanopi, tenda, gerobak, dan parkir liar tidak terlihat, sehingga lebar efektif di lapangan hampir selalu lebih sempit dari angka di sini. Uji ketiga di atas memberi besarannya: sekitar dua meter lebih lebar dari lebar badan jalan yang tercatat di OpenStreetMap.',
		'Tinggi bangunan hanya terukur untuk bangunan yang punya tag tinggi atau jumlah lantai di OpenStreetMap. Sisanya diperkirakan dari luas tapak memakai rata-rata bucket yang dihitung dari subset terukur di wilayah yang sama.',
		'Kelas material diperkirakan dari luas tapak dan tinggi, bukan hasil survei. Tag building:material dipakai bila tersedia.',
		'Titik henti adalah simpul jaringan pada komponen kelas unit besar yang terhubung ke jalan bernama. Ini bukan pos parkir resmi dan tidak memperhitungkan radius putar kendaraan.',
		'Model penjalaran api memakai satu regu pemadam yang efektif di seluruh kelurahan secara bersamaan. Keterbatasan jumlah unit dan jumlah jalur selang belum dimodelkan, sehingga jumlah bangunan terselamatkan adalah batas atas yang optimistis.',
		'Koefisien model dikalibrasi agar laju penjalaran masuk akal untuk permukiman padat, bukan hasil pencocokan terhadap catatan kejadian nyata.'
	];
</script>

<PageMeta
	title="Metode dan sumber data — Titik Henti"
	description="Cara lebar gang diturunkan dari citra bangunan, ambang kelas akses, model penjalaran api, serta sumber data dan lisensinya."
/>

<div class="flex-1 px-5 py-12 sm:px-10">
	<div class="measure-rail mx-auto w-full max-w-4xl">
		<h1 class="font-display text-ink text-[clamp(2rem,6vw,3.4rem)] leading-[0.92] font-semibold">
			Bagaimana angka<br />di lembar ini dibuat
		</h1>
		<div class="bg-ink mt-6 mb-10 h-[2px] w-full"></div>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-2 text-[18px] leading-tight font-semibold">
				Seberapa akurat lebar gang di sini
			</h2>
			<p class="text-ink prose-measure mb-5 text-[13px] leading-[1.6]">
				Angka lebar gang adalah keluaran algoritma, bukan hasil ukur. Karena itu pertanyaan pertama
				yang pantas diajukan adalah seberapa jauh algoritma ini boleh dipercaya. Tiga pengujian di
				bawah ini kami tampilkan lebih dulu, termasuk bagian yang belum selesai.
			</p>

			<h3 class="font-display text-ink mb-1.5 text-[14px] leading-none font-semibold">
				Uji pertama, permukiman sintetis dengan lebar yang sudah diketahui
			</h3>
			<p class="text-graphite prose-measure mb-3 text-[12.5px] leading-[1.6]">
				Permukiman buatan berisi {SYNTHETIC_BUILDING_COUNT} bangunan disusun dengan lebar gang yang
				sudah ditetapkan sebelumnya, lalu dilewatkan algoritma yang sama dengan yang dipakai produk
				ini. Karena lebar sebenarnya diketahui, selisihnya dapat dihitung persis.
			</p>
			<table class="w-full">
				<thead>
					<tr class="border-ink/30 border-b">
						<th class="field-label-sm text-graphite py-2 text-left">Lebar sebenarnya</th>
						<th class="field-label-sm text-graphite py-2 text-right">Lebar terukur</th>
						<th class="field-label-sm text-graphite py-2 text-right">Selisih</th>
					</tr>
				</thead>
				<tbody>
					{#each SYNTHETIC_WIDTH_CHECKS as check (check.trueWidthMeters)}
						<tr class="hairline-b">
							<td class="readout text-ink py-2 text-[12px]">
								{formatMeters(check.trueWidthMeters, 2)}
							</td>
							<td class="readout text-ink py-2 text-right text-[12px]">
								{formatMeters(check.measuredWidthMeters, 2)}
							</td>
							<td class="readout text-ink py-2 text-right text-[12px]">
								{formatMeters(measureAbsoluteError(check), 2)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
				<div>
					<dt class="field-label-sm text-graphite">Segmen terdeteksi</dt>
					<dd class="readout text-ink mt-1.5">{SYNTHETIC_SEGMENT_COUNT}</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Total panjang</dt>
					<dd class="readout text-ink mt-1.5">
						{formatMeters(SYNTHETIC_TOTAL_LENGTH_METERS, 1)}
					</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Resolusi raster</dt>
					<dd class="readout text-ink mt-1.5">
						{formatMeters(SYNTHETIC_RASTER_RESOLUTION_METERS, 2)}
					</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Selisih terbesar</dt>
					<dd class="readout text-ink mt-1.5">{formatMeters(largestSyntheticError, 2)}</dd>
				</div>
			</dl>
			<p class="text-graphite prose-measure mt-3 text-[12px] leading-[1.6]">
				Uji ini memeriksa algoritmanya, bukan datanya. Hasil sempurna di sini berarti perhitungan
				geometrinya benar bila bentuk bangunan yang masuk juga benar. Uji ini tidak membuktikan
				bahwa tapak bangunan dari satelit sesuai dengan keadaan di lapangan.
			</p>

			<h3 class="font-display text-ink mt-8 mb-1.5 text-[14px] leading-none font-semibold">
				Uji kedua, ukur meteran di lapangan
			</h3>
			{#if FIELD_MEASUREMENTS.length === 0}
				<div class="hairline-box bg-paper px-4 py-4">
					<p class="text-ink prose-measure text-[12.5px] leading-[1.6]">
						Belum dilakukan. Rencananya {FIELD_MEASUREMENT_TARGET_COUNT} gang diukur dengan meteran,
						lalu hasilnya disandingkan dengan keluaran pipeline di tabel ini, lolos bila selisihnya
						paling banyak {formatDecimal(FIELD_MEASUREMENT_TOLERANCE_METERS, 1)} meter.
					</p>
					<p class="text-graphite prose-measure mt-2.5 text-[12px] leading-[1.6]">
						Selama tabel ini kosong, seluruh lebar gang di produk ini belum pernah dibandingkan
						dengan ukuran sebenarnya di lapangan. Kami menampilkan kekosongan ini, bukan
						menyembunyikannya, karena inilah batas terpenting dari apa yang bisa dijanjikan produk
						ini sekarang.
					</p>
				</div>
			{:else}
				<table class="w-full">
					<thead>
						<tr class="border-ink/30 border-b">
							<th class="field-label-sm text-graphite py-2 text-left">Gang</th>
							<th class="field-label-sm text-graphite py-2 text-right">Ukur meteran</th>
							<th class="field-label-sm text-graphite py-2 text-right">Keluaran pipeline</th>
							<th class="field-label-sm text-graphite py-2 text-right">Selisih</th>
						</tr>
					</thead>
					<tbody>
						{#each FIELD_MEASUREMENTS as measurement (measurement.label)}
							{@const error = measureFieldError(measurement)}
							<tr class="hairline-b">
								<td class="text-ink py-2 pr-3 text-[12px]">{measurement.label}</td>
								<td class="readout text-ink py-2 text-right text-[12px]">
									{formatMeters(measurement.tapeWidthMeters, 2)}
								</td>
								<td class="readout text-ink py-2 text-right text-[12px]">
									{formatMeters(measurement.pipelineWidthMeters, 2)}
								</td>
								<td
									class="readout py-2 text-right text-[12px]"
									class:text-ink={error <= FIELD_MEASUREMENT_TOLERANCE_METERS}
									class:text-alarm={error > FIELD_MEASUREMENT_TOLERANCE_METERS}
								>
									{formatMeters(error, 2)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="text-graphite prose-measure mt-3 text-[12px] leading-[1.6]">
					{fieldMeasurementsWithinTolerance} dari {FIELD_MEASUREMENTS.length} gang berada dalam
					toleransi {formatDecimal(FIELD_MEASUREMENT_TOLERANCE_METERS, 1)} meter.
				</p>
			{/if}

			<h3 class="font-display text-ink mt-8 mb-1.5 text-[14px] leading-none font-semibold">
				Uji ketiga, pembanding silang dengan OpenStreetMap
			</h3>
			<p class="text-graphite prose-measure mb-3 text-[12.5px] leading-[1.6]">
				Sebagian jalan di {OSM_WIDTH_CHECK.villageName} sudah ditandai lebarnya oleh kontributor
				OpenStreetMap. Tanda itu dibuat orang, bukan diturunkan dari citra, jadi berasal dari jalur
				yang berbeda dengan angka kami. Dari {formatCount(OSM_WIDTH_CHECK.taggedWayCount)} ruas
				bertanda lebar, {formatCount(OSM_WIDTH_CHECK.primary.matchedWayCount)} ruas dapat dicocokkan
				dengan yakin ke segmen kami, karena garisnya benar-benar berimpit sepanjang ruas.
			</p>
			<dl class="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
				<div>
					<dt class="field-label-sm text-graphite">Ruas tercocokkan</dt>
					<dd class="readout text-ink mt-1.5">{formatCount(OSM_WIDTH_CHECK.primary.matchedWayCount)}</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Median selisih</dt>
					<dd class="readout text-ink mt-1.5">
						+{formatMeters(OSM_WIDTH_CHECK.primary.medianDifferenceMeters, 2)}
					</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Angka kami lebih lebar</dt>
					<dd class="readout text-ink mt-1.5">
						{roundShareToTenths(OSM_WIDTH_CHECK.primary.pipelineWiderShare)} dari 10 ruas
					</dd>
				</div>
				<div>
					<dt class="field-label-sm text-graphite">Selisih dalam 0,5 m</dt>
					<dd class="readout text-ink mt-1.5">
						{formatCount(OSM_WIDTH_CHECK.primary.withinHalfMeterCount)} ruas
					</dd>
				</div>
			</dl>
			<div class="hairline-box bg-paper mt-4 px-4 py-4">
				<p class="text-ink prose-measure text-[12.5px] leading-[1.6]">
					Hasil ini tidak membuktikan angka kami benar. Yang dibuktikannya lebih penting: kedua
					angka mengukur hal yang berbeda. OpenStreetMap mencatat lebar badan jalan. Kami
					mengukur ruang bebas di antara tapak bangunan, yang ikut menghitung teras, halaman,
					parkir, dan saluran air.
				</p>
				<p class="text-ink prose-measure mt-2.5 text-[12.5px] leading-[1.6]">
					Karena itu lebar gang di produk ini sebaiknya dibaca sebagai batas atas. Lebar yang
					benar-benar bisa dilewati kendaraan hampir pasti lebih sempit, dan pangsa gang yang tidak
					terlalui kendaraan kemungkinan besar lebih tinggi dari angka yang kami tampilkan, bukan
					lebih rendah.
				</p>
			</div>
			<p class="text-graphite prose-measure mt-3 text-[12px] leading-[1.6]">
				Temuan ini diuji ulang pada {OSM_WIDTH_CHECK.sensitivityConfigurationCount} kombinasi aturan
				pencocokan, dari yang longgar sampai yang ketat. Median selisihnya selalu berada di antara
				+{formatDecimal(OSM_WIDTH_CHECK.sensitivityMedianRangeMeters[0], 2)} dan
				+{formatDecimal(OSM_WIDTH_CHECK.sensitivityMedianRangeMeters[1], 2)} meter, dan angka kami
				selalu lebih lebar pada {roundShareToTenths(OSM_WIDTH_CHECK.sensitivityWiderShareRange[0])}
				sampai {roundShareToTenths(OSM_WIDTH_CHECK.sensitivityWiderShareRange[1])} dari 10 ruas. Jadi
				arah temuannya tidak bergantung pada aturan pencocokan yang dipilih. Sampelnya cenderung
				jalan permukiman yang bernama, bukan gang tersempit, karena ruas itulah yang paling sering
				ditandai lebarnya. Dicek {formatDate(OSM_WIDTH_CHECK.checkedAt)}.
			</p>
		</section>

		<section class="mb-12">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Pipeline data</h2>
			<ol class="flex flex-col">
				{#each pipelineStages as stage (stage.index)}
					<li class="hairline-b flex gap-4 py-4 last:border-b-0">
						<span class="field-label text-graphite w-8 shrink-0 pt-[2px]">
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
					Cellular automata heterogen di atas graf jarak antarbangunan. Mekanismenya mengacu pada
					model berbasis fisika Himoto dan Tanaka untuk kebakaran perkotaan padat, disederhanakan
					menjadi tiga suku ditambah percikan bara.
				</p>
				<div class="hairline-box bg-paper mt-4 px-4 py-3">
					<p class="readout text-ink">
						P(j) = 1 − Π<sub>i∈menyala</sub> (1 − p<sub>ij</sub>)
					</p>
					<p class="readout text-ink mt-2">
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
			<table class="w-full">
				<thead>
					<tr class="border-ink/30 border-b">
						<th class="field-label-sm text-graphite py-2 text-left">Lapisan</th>
						<th class="field-label-sm text-graphite py-2 text-left">Sumber</th>
						<th class="field-label-sm text-graphite py-2 text-right">Lisensi</th>
					</tr>
				</thead>
				<tbody>
					{#each meta.provenance as source (source.label)}
						<tr class="hairline-b">
							<td class="text-ink py-2 pr-3 text-[12px]">{source.label}</td>
							<td class="text-graphite py-2 pr-3 text-[11.5px] leading-[1.45]">
								{source.source}
							</td>
							<td class="text-ink py-2 text-right text-[11px]">{source.licence}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="field-label-sm text-graphite mt-3">
				Tanggal olah {formatDate(meta.processedAt)}, pipeline versi {meta
					.pipelineVersion}
			</p>
		</section>

		<section class="mb-4">
			<h2 class="font-display text-ink mb-4 text-[18px] leading-tight font-semibold">Batasan yang harus dibaca lebih dulu</h2>
			<ul class="flex flex-col">
				{#each limitations as limitation (limitation)}
					<li class="hairline-b py-3 last:border-b-0">
						<p class="text-ink text-[12.5px] leading-[1.6]">{limitation}</p>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</div>
