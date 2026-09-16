<script lang="ts">
	interface Props {
		tone?: 'terang' | 'gelap';
		onretry: () => void;
	}

	let { tone = 'terang', onretry }: Props = $props();
</script>

<div class="prose-measure" role="alert">
	<h2
		class="font-display text-[18px] leading-tight font-semibold"
		class:text-ink={tone === 'terang'}
		class:text-concrete={tone === 'gelap'}
	>
		Data wilayah belum tersedia
	</h2>
	<p
		class="mt-2 text-[12.5px] leading-[1.6]"
		class:text-ink={tone === 'terang'}
		class:text-graphite-pale={tone === 'gelap'}
	>
		Berkas jaringan gang dan tabel bangunan tidak berhasil diambil, jadi peta dan angka di lembar ini
		belum bisa ditampilkan. Biasanya ini karena sambungan terputus di tengah jalan.
	</p>
	<p
		class="mt-2 text-[12.5px] leading-[1.6]"
		class:text-ink={tone === 'terang'}
		class:text-graphite-pale={tone === 'gelap'}
	>
		Coba muat ulang datanya. Sementara itu, panduan siaga kebakaran tetap bisa dibaca karena tidak
		bergantung pada data wilayah.
	</p>
	<div class="mt-4 flex flex-wrap gap-2">
		<button
			type="button"
			class="field-button-solid"
			class:bg-concrete={tone === 'gelap'}
			class:text-ink={tone === 'gelap'}
			onclick={onretry}
		>
			Muat ulang data
		</button>
		<a
			href="/artikel/"
			class="field-button"
			class:border-concrete={tone === 'gelap'}
			class:text-concrete={tone === 'gelap'}
		>
			Baca panduan siaga
		</a>
	</div>
</div>
