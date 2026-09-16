<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ARTICLE_AUDIENCES,
		ARTICLE_CATEGORIES,
		articles,
		filterArticles,
		type ArticleAudience,
		type ArticleCategory
	} from '$lib/content/artikel';
	import { formatDate } from '$lib/format';

	let pencarian = $state('');

	const kategoriTerpilih = $derived.by<ArticleCategory | null>(() => {
		if (!browser) return null;
		const nilai = page.url.searchParams.get('kategori');
		return ARTICLE_CATEGORIES.includes(nilai as ArticleCategory)
			? (nilai as ArticleCategory)
			: null;
	});

	const untukTerpilih = $derived.by<ArticleAudience | null>(() => {
		if (!browser) return null;
		const nilai = page.url.searchParams.get('untuk');
		return ARTICLE_AUDIENCES.includes(nilai as ArticleAudience)
			? (nilai as ArticleAudience)
			: null;
	});

	const hasil = $derived(filterArticles(articles, kategoriTerpilih, untukTerpilih, pencarian));
	const adaSaringan = $derived(
		kategoriTerpilih !== null || untukTerpilih !== null || pencarian.trim().length > 0
	);

	function ubahSaringan(kunci: string, nilai: string | null): void {
		if (!browser) return;
		const parameter = new URLSearchParams(page.url.searchParams);
		if (nilai === null) parameter.delete(kunci);
		else parameter.set(kunci, nilai);
		const kueri = parameter.toString();
		void goto(kueri ? `/artikel/?${kueri}` : '/artikel/', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function hapusSaringan(): void {
		pencarian = '';
		void goto('/artikel/', { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Artikel siaga kebakaran — Titik Henti</title>
	<meta
		name="description"
		content="Panduan singkat siaga kebakaran permukiman padat, seluruhnya bersumber dari lembaga resmi."
	/>
</svelte:head>

<div class="flex-1 px-5 py-12 sm:px-10">
	<div class="measure-rail mx-auto w-full max-w-4xl">
		<h1 class="font-display text-ink text-[clamp(2rem,6vw,3.4rem)] leading-[0.92] font-semibold">
			Yang perlu diketahui<br />sebelum, saat, dan sesudah
		</h1>
		<p class="text-ink prose-measure mt-5 text-[14px] leading-[1.65]">
			Panduan pendek untuk permukiman padat. Setiap langkah keselamatan di sini berasal dari
			lembaga resmi dan sumbernya dicantumkan di akhir tiap artikel. Tidak ada langkah yang kami
			karang sendiri.
		</p>

		<div class="bg-ink mt-7 mb-7 h-[2px] w-full"></div>

		<div class="flex flex-col gap-3">
			<div>
				<p class="field-label-sm text-graphite mb-1.5">Kapan</p>
				<div class="flex flex-wrap gap-1.5" role="group" aria-label="Saring menurut kategori">
					{#each ARTICLE_CATEGORIES as kategori (kategori)}
						<button
							type="button"
							class="field-button px-2.5 py-1"
							class:bg-ink={kategoriTerpilih === kategori}
							class:text-concrete={kategoriTerpilih === kategori}
							aria-pressed={kategoriTerpilih === kategori}
							onclick={() =>
								ubahSaringan('kategori', kategoriTerpilih === kategori ? null : kategori)}
						>
							{kategori}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<p class="field-label-sm text-graphite mb-1.5">Untuk siapa</p>
				<div class="flex flex-wrap gap-1.5" role="group" aria-label="Saring menurut pembaca">
					{#each ARTICLE_AUDIENCES as untuk (untuk)}
						<button
							type="button"
							class="field-button px-2.5 py-1"
							class:bg-ink={untukTerpilih === untuk}
							class:text-concrete={untukTerpilih === untuk}
							aria-pressed={untukTerpilih === untuk}
							onclick={() => ubahSaringan('untuk', untukTerpilih === untuk ? null : untuk)}
						>
							{untuk}
						</button>
					{/each}
				</div>
			</div>

			<div class="max-w-sm">
				<label class="field-label-sm text-graphite mb-1.5 block" for="cari-artikel">
					Cari judul atau ringkasan
				</label>
				<input id="cari-artikel" class="field-input" type="search" bind:value={pencarian} />
			</div>
		</div>

		<p class="field-label-sm text-graphite mt-6" aria-live="polite">
			{hasil.length} dari {articles.length} artikel
		</p>

		{#if hasil.length === 0}
			<div class="hairline-box bg-paper mt-3 px-4 py-5">
				<p class="text-ink prose-measure text-[13px] leading-[1.6]">
					Tidak ada artikel yang cocok dengan saringan ini. Hapus saringannya untuk melihat
					seluruh artikel.
				</p>
				<button type="button" class="field-button-solid mt-3" onclick={hapusSaringan}>
					Hapus saringan
				</button>
			</div>
		{:else}
			<ol class="mt-3 flex flex-col">
				{#each hasil as artikel (artikel.slug)}
					<li class="hairline-b py-4 last:border-b-0">
						<a href="/artikel/{artikel.slug}/" class="group block">
							<h2
								class="font-display text-ink text-[17px] leading-tight font-semibold underline-offset-4 group-hover:underline"
							>
								{artikel.judul}
							</h2>
							<p class="text-graphite prose-measure mt-1.5 text-[13px] leading-[1.6]">
								{artikel.ringkasan}
							</p>
							<p class="field-label-sm text-graphite mt-2">
								{artikel.kategori}, {artikel.waktuBacaMenit} menit baca, untuk {artikel.untuk.join(
									' dan '
								)}
							</p>
						</a>
					</li>
				{/each}
			</ol>
		{/if}

		{#if adaSaringan}
			<button type="button" class="field-button mt-5" onclick={hapusSaringan}>
				Hapus saringan
			</button>
		{/if}

		<p class="text-graphite prose-measure mt-8 text-[12px] leading-[1.6]">
			Delapan artikel direncanakan. Empat yang sudah terbit adalah yang sumber resminya sudah
			ditemukan dan dapat dikutip. Sisanya belum ditulis karena sumbernya belum ada, dan menulis
			langkah keselamatan tanpa sumber adalah hal yang tidak kami lakukan. Terakhir diperbarui
			{formatDate(articles[0].diperbarui)}.
		</p>
	</div>
</div>
