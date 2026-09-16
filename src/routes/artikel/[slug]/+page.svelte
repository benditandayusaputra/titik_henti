<script lang="ts">
	import { ARTICLE_WRITE_LINE_COUNT } from '$lib/domain/constants';
	import { formatDate } from '$lib/format';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const artikel = $derived(data.article);
	const writeLines = Array.from({ length: ARTICLE_WRITE_LINE_COUNT }, (_, index) => index);

	function cetak(): void {
		window.print();
	}
</script>

<svelte:head>
	<title>{artikel.judul} — Titik Henti</title>
	<meta name="description" content={artikel.ringkasan} />
</svelte:head>

<div class="flex-1 px-5 py-12 sm:px-10 print:p-0">
	<article
		class="bg-paper hairline-box mx-auto w-full max-w-2xl px-5 py-8 sm:px-9 print:border-0 print:bg-white print:p-0"
	>
		<p class="field-label-sm text-graphite print:hidden">
			<a href="/artikel/" class="underline underline-offset-2">Kembali ke daftar artikel</a>
		</p>

		<h1
			class="font-display text-ink mt-4 text-[clamp(1.7rem,4.5vw,2.6rem)] leading-[1.05] font-semibold print:mt-0 print:text-[24pt]"
		>
			{artikel.judul}
		</h1>

		<p class="text-graphite prose-measure mt-3 text-[14px] leading-[1.6] print:text-[11pt]">
			{artikel.ringkasan}
		</p>

		<p class="field-label-sm text-graphite mt-3">
			{artikel.kategori}, {artikel.waktuBacaMenit} menit baca, untuk {artikel.untuk.join(' dan ')}
		</p>

		<div class="bg-ink mt-5 mb-7 h-[2px] w-full"></div>

		<div class="artikel-isi prose-measure">
			{@html artikel.html}
		</div>

		<section class="hairline-t mt-10 pt-5">
			<h2 class="font-display text-ink text-[15px] leading-none font-semibold">Sumber</h2>
			<ul class="mt-3 flex flex-col gap-2">
				{#each artikel.sumber as sumber (sumber.tautan)}
					<li class="text-ink text-[12.5px] leading-[1.6]">
						{sumber.lembaga}
						<span class="tautan-cetak text-graphite block break-all">
							<a href={sumber.tautan} class="underline underline-offset-2" rel="noreferrer">
								{sumber.tautan}
							</a>
						</span>
					</li>
				{/each}
			</ul>
			<p class="field-label-sm text-graphite mt-4">
				Diperbarui {formatDate(artikel.diperbarui)}
			</p>
		</section>

		<section class="ruang-tulis hairline-t mt-8 hidden pt-5">
			<h2 class="font-display text-ink text-[13pt] leading-none font-semibold">
				Catatan pos RT
			</h2>
			{#each writeLines as baris (baris)}
				<div class="write-line"></div>
			{/each}
		</section>

		<div class="mt-8 flex flex-wrap gap-2 print:hidden">
			<button type="button" class="field-button-solid" onclick={cetak}>
				Cetak satu halaman A4
			</button>
			<a href="/peta/" class="field-button">Buka lembar kerja</a>
		</div>
	</article>
</div>

<style>
	.artikel-isi :global(h2) {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--color-ink);
		margin-top: 2rem;
		margin-bottom: 0.6rem;
	}

	.artikel-isi :global(p) {
		font-size: 1rem;
		line-height: 1.65;
		color: var(--color-ink);
		margin-bottom: 1rem;
	}

	.artikel-isi :global(ol),
	.artikel-isi :global(ul) {
		margin-bottom: 1rem;
		padding-left: 1.4rem;
		font-size: 1rem;
		line-height: 1.65;
	}

	.artikel-isi :global(ol) {
		list-style: decimal;
	}

	.artikel-isi :global(ul) {
		list-style: disc;
	}

	.artikel-isi :global(li) {
		margin-bottom: 0.45rem;
	}

	.artikel-isi :global(strong) {
		font-weight: 600;
	}

	.artikel-isi :global(blockquote) {
		border-left: 4px solid var(--color-alarm);
		padding: 0.6rem 0 0.6rem 0.9rem;
		margin: 1.4rem 0;
	}

	.artikel-isi :global(blockquote p) {
		margin-bottom: 0;
		font-weight: 500;
	}

	@media print {
		@page {
			size: A4 portrait;
			margin: 14mm;
		}

		.artikel-isi :global(p),
		.artikel-isi :global(ol),
		.artikel-isi :global(ul) {
			font-size: 11pt;
			line-height: 1.5;
		}

		.artikel-isi :global(h2) {
			font-size: 13pt;
			margin-top: 1rem;
		}

		.ruang-tulis {
			display: block;
		}

		.tautan-cetak a {
			text-decoration: none;
			color: var(--color-ink);
		}
	}
</style>
