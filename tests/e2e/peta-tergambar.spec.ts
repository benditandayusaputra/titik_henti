import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const WARNA_AIR = { merah: 15, hijau: 124, biru: 138 };
const TOLERANSI_WARNA = 22;
const LEBAR_AREA_PETA = 1058;
const TINGGI_MASTHEAD = 60;
const MINIMUM_PIKSEL_SUMBER_AIR = 300;

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(4000);
	await tutupPanduan(page);
}

async function hitungPikselWarnaAir(page: Page): Promise<number> {
	const gambar = await page.screenshot({
		clip: { x: 0, y: TINGGI_MASTHEAD, width: LEBAR_AREA_PETA, height: 900 - TINGGI_MASTHEAD }
	});
	return page.evaluate(
		async ({ dataUrl, warna, toleransi }) => {
			const citra = new Image();
			citra.src = dataUrl;
			await citra.decode();
			const kanvas = document.createElement('canvas');
			kanvas.width = citra.width;
			kanvas.height = citra.height;
			const konteks = kanvas.getContext('2d');
			if (!konteks) return 0;
			konteks.drawImage(citra, 0, 0);
			const piksel = konteks.getImageData(0, 0, kanvas.width, kanvas.height).data;
			let jumlah = 0;
			for (let indeks = 0; indeks < piksel.length; indeks += 4) {
				if (
					Math.abs(piksel[indeks] - warna.merah) < toleransi &&
					Math.abs(piksel[indeks + 1] - warna.hijau) < toleransi &&
					Math.abs(piksel[indeks + 2] - warna.biru) < toleransi
				) {
					jumlah += 1;
				}
			}
			return jumlah;
		},
		{
			dataUrl: `data:image/png;base64,${gambar.toString('base64')}`,
			warna: WARNA_AIR,
			toleransi: TOLERANSI_WARNA
		}
	);
}

test.describe('lapisan deck.gl benar-benar tergambar di peta', () => {
	test('sumber air tergambar saat peta pertama dimuat', async ({ page }) => {
		await bukaLembarKerja(page);
		expect(await hitungPikselWarnaAir(page)).toBeGreaterThan(MINIMUM_PIKSEL_SUMBER_AIR);
	});

	test('lapisan tetap tergambar tanpa galat setelah berpindah tab berulang kali', async ({ page }) => {
		const galat: string[] = [];
		page.on('console', (pesan) => {
			if (pesan.type() === 'error') galat.push(pesan.text());
		});

		await bukaLembarKerja(page);
		for (const tab of ['Air', 'Akses', 'Air', 'Titik henti', 'Akses']) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			await page.waitForTimeout(1500);
		}

		expect(galat).toEqual([]);
		expect(await hitungPikselWarnaAir(page)).toBeGreaterThan(MINIMUM_PIKSEL_SUMBER_AIR);
	});

	test('garis selang tergambar dan mengganti bangunan tidak memicu galat layer', async ({ page }) => {
		test.setTimeout(180000);
		const galat: string[] = [];
		page.on('console', (pesan) => {
			if (pesan.type() === 'error') galat.push(pesan.text());
		});

		await bukaLembarKerja(page);
		const pikselSebelumMemilih = await hitungPikselWarnaAir(page);

		const panelTitikHenti = page.locator('aside section').filter({ hasText: 'Titik henti kendaraan' });
		const panelBangunan = page.locator('aside section').filter({ hasText: 'Detail bangunan' });
		const bangunanBerselang = new Set<string>();

		for (let y = 250; y <= 760 && bangunanBerselang.size < 3; y += 35) {
			for (let x = 200; x <= 900 && bangunanBerselang.size < 3; x += 35) {
				await page.mouse.click(x, y);
				await page.waitForTimeout(60);
				if ((await panelBangunan.count()) === 0 || (await panelTitikHenti.count()) === 0) continue;
				const indeks = ((await panelBangunan.first().textContent()) ?? '').match(/Indeks\s*(\d{5})/)?.[1];
				const berselang = ((await panelTitikHenti.first().textContent()) ?? '').includes('Gulung');
				if (indeks && berselang && !bangunanBerselang.has(indeks)) {
					bangunanBerselang.add(indeks);
					await page.waitForTimeout(2800);
				}
			}
		}
		expect(bangunanBerselang.size).toBeGreaterThan(1);

		expect(await hitungPikselWarnaAir(page)).toBeGreaterThan(pikselSebelumMemilih);
		expect(galat).toEqual([]);
	});
});

