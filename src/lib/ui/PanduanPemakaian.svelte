<script lang="ts">
	import { panduan } from '$lib/ui/panduan.svelte';

	interface Langkah {
		sasaran: string;
		judul: string;
		isi: string;
	}

	const LANGKAH: Langkah[] = [
		{
			sasaran: '[data-panduan="peta"]',
			judul: 'Lembar ini menjawab berapa meter',
			isi: 'Peta menunjukkan lebar tiap gang di Kelurahan Palmerah. Warna garis menandai sampai mana kendaraan pemadam bisa masuk, dan sisanya harus ditempuh dengan menggelar selang.'
		},
		{
			sasaran: '[data-panduan="peta"]',
			judul: 'Mulai dengan memilih satu bangunan',
			isi: 'Pilih satu bangunan di peta. Sistem menarik jalur selang dari titik henti kendaraan terdekat ke bangunan itu, lalu mengukurnya dalam meter dan gulung selang.'
		},
		{
			sasaran: '[data-panduan="tab"]',
			judul: 'Angkanya dibaca di sini',
			isi: 'Tab Titik henti menampilkan panjang selang, jumlah gulung, dan tambahan waktu sebelum air sampai. Tab Akses berisi angka wilayah, tab Daftar berisi padanan tabel dari peta.'
		},
		{
			sasaran: '[data-panduan="tab"]',
			judul: 'Uji akibatnya',
			isi: 'Tab Api menjalankan penjalaran api dari titik yang Anda tetapkan. Tab Air menunjukkan bangunan yang tidak terjangkau selang. Tab Intervensi mencari perbaikan termurah pada anggaran yang Anda tentukan.'
		},
		{
			sasaran: '[data-panduan="kartu"]',
			judul: 'Bawa hasilnya ke lapangan',
			isi: 'Kartu siaga RT merangkum titik henti, sumber air, dan kantong tak terjangkau dalam satu halaman A4 hitam putih, siap dicetak dan ditempel di pos RT.'
		}
	];

	const JARAK_SOROT = 4;

	let indeks = $state(0);
	let kotak = $state.raw<{ atas: number; kiri: number; lebar: number; tinggi: number } | null>(null);
	let panelPanduan = $state<HTMLDivElement | undefined>();

	const langkah = $derived(LANGKAH[indeks]);

	function bawaSasaranKeLayar(): void {
		const sasaran = document.querySelector(langkah.sasaran);
		if (!sasaran) return;
		const batas = sasaran.getBoundingClientRect();
		const tertutupPanel = batas.bottom > window.innerHeight * 0.62;
		if (batas.top < 0 || tertutupPanel) {
			sasaran.scrollIntoView({ block: 'center', behavior: 'instant' });
		}
	}

	function ukurSasaran(): void {
		const sasaran = document.querySelector(langkah.sasaran);
		if (!sasaran) {
			kotak = null;
			return;
		}
		const batas = sasaran.getBoundingClientRect();
		kotak = {
			atas: batas.top - JARAK_SOROT,
			kiri: batas.left - JARAK_SOROT,
			lebar: batas.width + JARAK_SOROT * 2,
			tinggi: batas.height + JARAK_SOROT * 2
		};
	}

	$effect(() => {
		if (!panduan.terbuka) return;
		void langkah;
		bawaSasaranKeLayar();
		ukurSasaran();
		window.addEventListener('resize', ukurSasaran);
		window.addEventListener('scroll', ukurSasaran, true);
		return () => {
			window.removeEventListener('resize', ukurSasaran);
			window.removeEventListener('scroll', ukurSasaran, true);
		};
	});

	$effect(() => {
		if (panduan.terbuka) panelPanduan?.focus();
	});

	function lanjut(): void {
		if (indeks + 1 >= LANGKAH.length) {
			selesai();
			return;
		}
		indeks += 1;
	}

	function selesai(): void {
		indeks = 0;
		panduan.tutup();
	}

	function tanganiTombol(event: KeyboardEvent): void {
		if (event.key === 'Escape') selesai();
	}
</script>

<svelte:window onkeydown={panduan.terbuka ? tanganiTombol : undefined} />

{#if panduan.terbuka}
	<div class="pointer-events-none fixed inset-0 z-40">
		{#if kotak}
			<div
				class="border-ink absolute border-2"
				style:top={`${kotak.atas}px`}
				style:left={`${kotak.kiri}px`}
				style:width={`${kotak.lebar}px`}
				style:height={`${kotak.tinggi}px`}
			></div>
		{/if}
	</div>

	<div
		class="bg-paper hairline-box pointer-events-auto fixed right-4 bottom-4 left-4 z-50 max-w-[420px] px-4 py-4 sm:left-auto"
		role="dialog"
		aria-modal="false"
		aria-labelledby="judul-panduan"
		tabindex="-1"
		bind:this={panelPanduan}
	>
		<p class="field-label-sm text-graphite">
			Panduan pemakaian, langkah <span class="readout text-ink">{indeks + 1}</span>/{LANGKAH.length}
		</p>
		<h2 id="judul-panduan" class="font-display text-ink mt-1.5 text-[17px] leading-tight font-semibold">
			{langkah.judul}
		</h2>
		<p class="text-graphite prose-measure mt-2 text-[12.5px] leading-[1.6]">{langkah.isi}</p>

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button type="button" class="field-button-solid" onclick={lanjut}>
				{indeks + 1 === LANGKAH.length ? 'Mulai pakai' : 'Lanjut'}
			</button>
			<button
				type="button"
				class="field-button"
				disabled={indeks === 0}
				onclick={() => (indeks -= 1)}
			>
				Sebelumnya
			</button>
			<button type="button" class="field-button ml-auto" onclick={selesai}>Lewati</button>
		</div>
	</div>
{/if}
