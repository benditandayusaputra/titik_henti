import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';

const LEBAR_AREA_CARI_GARIS = 900;

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(3000);
}

async function klikGarisGangTerang(page: Page): Promise<void> {
	const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
	if (!kanvas) throw new Error('kanvas peta tidak ditemukan');
	const gambar = await page.screenshot({
		clip: { x: kanvas.x, y: kanvas.y, width: LEBAR_AREA_CARI_GARIS, height: kanvas.height }
	});
	const titik = await page.evaluate(async (dataUrl) => {
		const citra = new Image();
		citra.src = dataUrl;
		await citra.decode();
		const kanvasBantu = document.createElement('canvas');
		kanvasBantu.width = citra.width;
		kanvasBantu.height = citra.height;
		const konteks = kanvasBantu.getContext('2d');
		if (!konteks) return null;
		konteks.drawImage(citra, 0, 0);
		const piksel = konteks.getImageData(0, 0, kanvasBantu.width, kanvasBantu.height).data;
		for (let y = 200; y < kanvasBantu.height; y += 3) {
			for (let x = 200; x < kanvasBantu.width; x += 3) {
				const indeks = (y * kanvasBantu.width + x) * 4;
				if (piksel[indeks] > 200 && piksel[indeks + 1] > 195 && piksel[indeks + 2] > 185) {
					return [x, y];
				}
			}
		}
		return null;
	}, `data:image/png;base64,${gambar.toString('base64')}`);
	if (!titik) throw new Error('garis gang tidak ditemukan di tangkapan layar peta');
	await page.mouse.click(kanvas.x + titik[0], kanvas.y + titik[1]);
	await page.waitForTimeout(800);
}

const tabAktif = (page: Page) => page.locator('nav[aria-label="Panel kerja"] [aria-pressed="true"]');

test.describe('alur utama dari sisi juri', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('klik pada garis gang tidak membatalkan mode titik api', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Api', exact: true }).click();
		await page.getByRole('button', { name: 'Tetapkan titik api' }).click();
		await klikGarisGangTerang(page);

		await expect(tabAktif(page)).toHaveText('Api');
		await expect(page.getByRole('button', { name: 'Mode titik api aktif' })).toBeVisible();
	});

	test('klik pada garis gang menaruh hidran uji coba saat modenya aktif', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Air', exact: true }).click();
		await page.getByRole('button', { name: 'Taruh hidran uji coba' }).click();
		await klikGarisGangTerang(page);

		await expect(tabAktif(page)).toHaveText('Air');
		await expect(page.getByRole('button', { name: 'Hapus 1 hidran uji coba' })).toBeEnabled();
	});

	test('pindah tab membuka panel dari atas, bukan dari posisi gulir tab sebelumnya', async ({
		page
	}) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Daftar', exact: true }).click();
		await page.getByRole('button', { name: /pilih bangunan ini/ }).first().click();
		const isiPanel = page.getByRole('region', { name: 'Isi panel kerja' });
		await isiPanel.evaluate((elemen) => (elemen.scrollTop = elemen.scrollHeight));
		await page.getByRole('button', { name: 'Titik henti', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Titik henti kendaraan' })).toBeInViewport();
		expect(await isiPanel.evaluate((elemen) => elemen.scrollTop)).toBe(0);
	});
});

test.describe('alur utama di layar ponsel', () => {
	test.use({ viewport: devices['iPhone 13'].viewport, hasTouch: true, isMobile: true });

	test('memulai mode taruh hidran menggulir peta kembali ke layar', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Air', exact: true }).click();
		const tombol = page.getByRole('button', { name: 'Taruh hidran uji coba' });
		await tombol.scrollIntoViewIfNeeded();
		await tombol.click();
		await page.waitForTimeout(300);

		const posisi = await page.evaluate(() => {
			const kepala = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
			const peta = document.querySelector('.maplibregl-canvas')?.getBoundingClientRect();
			return { kepala, atasPeta: peta?.top ?? -1, bawahPeta: peta?.bottom ?? -1 };
		});
		expect(posisi.atasPeta).toBeGreaterThanOrEqual(posisi.kepala - 1);
		expect(posisi.bawahPeta).toBeLessThanOrEqual(devices['iPhone 13'].viewport.height + 1);
	});

	test('hasil titik henti tampil di layar pertama setelah bangunan dipilih', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Daftar', exact: true }).click();
		await page.getByRole('button', { name: /pilih bangunan ini/ }).first().click();
		await page.getByRole('button', { name: 'Titik henti', exact: true }).click();
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(300);

		const judulHasil = page.getByRole('heading', { name: 'Titik henti kendaraan' });
		const judulBangunan = page.getByRole('heading', { name: 'Detail bangunan' });
		await expect(judulBangunan).toBeAttached();
		const [hasil, bangunan] = await Promise.all([judulHasil.boundingBox(), judulBangunan.boundingBox()]);
		expect(hasil && bangunan && hasil.y < bangunan.y).toBe(true);
		expect((hasil?.y ?? Infinity) + (hasil?.height ?? 0)).toBeLessThanOrEqual(
			devices['iPhone 13'].viewport.height
		);
	});

	test('baris tab daftar cukup besar untuk disentuh', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Daftar', exact: true }).click();
		await page.waitForTimeout(800);
		const hasil = await new AxeBuilder({ page }).withRules(['target-size']).analyze();
		expect(hasil.violations).toEqual([]);
	});
});

test.describe('mode pilih lokasi dan kendali simulasi', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('mode taruh hidran mati saat pindah tab', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Air', exact: true }).click();
		await page.getByRole('button', { name: 'Taruh hidran uji coba' }).click();
		await klikGarisGangTerang(page);
		await expect(page.getByRole('button', { name: 'Hapus 1 hidran uji coba' })).toBeEnabled();

		await page.getByRole('button', { name: 'Akses', exact: true }).click();
		await expect(page.getByText('Pilih titik di peta untuk hidran')).toBeHidden();
		await klikGarisGangTerang(page);

		await page.getByRole('button', { name: 'Air', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Hapus 1 hidran uji coba' })).toBeEnabled();
	});

	test('perbandingan menolak jalan tanpa titik api dan menyebut sebabnya', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Titik henti', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Bandingkan sebelum dan sesudah' })).toBeDisabled();
		await expect(page.getByText('Tetapkan minimal satu titik api di tab Api lebih dulu')).toBeVisible();
	});
});

test.describe('kendali simulasi di layar ponsel', () => {
	test.use({ viewport: devices['iPhone 13'].viewport, hasTouch: true, isMobile: true });

	test('menjalankan simulasi menggulir peta kembali ke layar', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Api', exact: true }).click();
		const tetapkan = page.getByRole('button', { name: 'Tetapkan titik api' });
		await tetapkan.scrollIntoViewIfNeeded();
		await tetapkan.click();
		const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
		if (!kanvas) throw new Error('kanvas peta tidak ditemukan');
		await page.touchscreen.tap(kanvas.x + kanvas.width / 2, kanvas.y + kanvas.height / 2);
		await page.waitForTimeout(600);

		const jalankan = page.getByRole('button', { name: 'Jalankan', exact: true });
		await jalankan.scrollIntoViewIfNeeded();
		await jalankan.click();
		await page.waitForTimeout(600);

		const porsi = await page.evaluate(() => {
			const peta = document.querySelector('.maplibregl-canvas')?.getBoundingClientRect();
			const kepala = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
			if (!peta) return 0;
			return Math.max(0, Math.min(peta.bottom, window.innerHeight) - Math.max(peta.top, kepala)) / peta.height;
		});
		expect(porsi).toBeGreaterThan(0.5);
	});
});
