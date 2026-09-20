<script lang="ts">
	import { page } from '$app/state';
	import PageMeta from '$lib/ui/PageMeta.svelte';

	const halamanTidakAda = $derived(page.status === 404);
	const judul = $derived(
		halamanTidakAda ? 'Halaman tidak ada — Titik Henti' : 'Halaman gagal dibuka — Titik Henti'
	);
</script>

<PageMeta
	title={judul}
	description="Alamat yang dibuka tidak ada di Titik Henti. Halaman ini menunjukkan jalan kembali ke lembar kerja, kartu siaga RT, dan artikel."
/>

<div class="flex-1 px-5 py-16 sm:px-10">
	<div class="mx-auto w-full max-w-2xl">
		<p class="field-label-sm text-graphite">Status {page.status}</p>
		<h1 class="font-display text-ink mt-3 text-[clamp(1.7rem,4.5vw,2.6rem)] leading-[1.05] font-semibold">
			{halamanTidakAda ? 'Alamat ini tidak ada di Titik Henti' : 'Halaman ini gagal dibuka'}
		</h1>
		<p class="text-graphite prose-measure mt-4 text-[14px] leading-[1.6]">
			{halamanTidakAda
				? 'Alamatnya mungkin salah ketik, atau halamannya sudah dipindah. Tiga halaman berikut adalah isi utama produk ini.'
				: 'Muat ulang halaman ini sebentar lagi. Bila tetap gagal, tiga halaman berikut adalah isi utama produk ini.'}
		</p>

		<div class="mt-8 flex flex-wrap gap-2">
			<a class="field-button-solid" href="/peta/">Buka lembar kerja</a>
			<a class="field-button" href="/kartu/">Kartu siaga RT</a>
			<a class="field-button" href="/artikel/">Artikel</a>
		</div>

		<p class="text-graphite mt-8 text-[11.5px] leading-[1.55]">
			Kembali ke <a class="text-ink underline underline-offset-2" href="/">ringkasan</a>.
		</p>
	</div>
</div>
