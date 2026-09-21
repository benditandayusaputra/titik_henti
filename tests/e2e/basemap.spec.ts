import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const POLA_LAYANAN_LATAR = '**/tiles.openfreemap.org/**';
const AMBANG_PIKSEL_JALAN = 200;

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(5000);
	await tutupPanduan(page);
}

async function hitungPikselJalanPutih(page: Page): Promise<number> {
	const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
	if (!kanvas) throw new Error('kanvas peta tidak ditemukan');
	const gambar = await page.screenshot({
		clip: {
			x: kanvas.x + kanvas.width * 0.08,
			y: kanvas.y + kanvas.height * 0.15,
			width: kanvas.width * 0.84,
			height: kanvas.height * 0.6
		}
	});
	return page.evaluate(async (dataUrl) => {
		const citra = new Image();
		citra.src = dataUrl;
		await citra.decode();
		const bantu = document.createElement('canvas');
		bantu.width = citra.width;
		bantu.height = citra.height;
		const konteks = bantu.getContext('2d');
		if (!konteks) return -1;
		konteks.drawImage(citra, 0, 0);
		const piksel = konteks.getImageData(0, 0, bantu.width, bantu.height).data;
		let jumlah = 0;
		for (let i = 0; i < piksel.length; i += 4 * 5) {
			if (piksel[i] === 255 && piksel[i + 1] === 255 && piksel[i + 2] === 255) jumlah += 1;
		}
		return jumlah;
	}, `data:image/png;base64,${gambar.toString('base64')}`);
}

test.describe('latar peta dari OpenFreeMap', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('jalan sekitar wilayah ikut tergambar di atas gaya sendiri', async ({ page }) => {
		const galat: string[] = [];
		page.on('console', (pesan) => {
			if (pesan.type() === 'error') galat.push(pesan.text());
		});
		await bukaLembarKerja(page);

		expect(await hitungPikselJalanPutih(page)).toBeGreaterThan(AMBANG_PIKSEL_JALAN);
		expect(galat).toEqual([]);
	});

	test('peta tetap tergambar dan sunyi saat layanan latar tidak bisa dihubungi', async ({
		page
	}) => {
		const galat: string[] = [];
		page.on('console', (pesan) => {
			if (pesan.type() === 'error') galat.push(pesan.text());
		});
		await page.route(POLA_LAYANAN_LATAR, (route) => route.abort());
		await bukaLembarKerja(page);

		expect(await hitungPikselJalanPutih(page)).toBeLessThan(AMBANG_PIKSEL_JALAN);
		await expect(page.getByRole('heading', { name: 'Titik henti kendaraan' })).toBeVisible();
		await expect(page.getByText('Ketuk rumah yang terbakar', { exact: true })).toBeVisible();
		expect(galat.filter((pesan) => !pesan.includes('net::ERR_FAILED'))).toEqual([]);
	});

	test('tidak ada pelanggaran kebijakan keamanan konten', async ({ page }) => {
		await page.addInitScript(() => {
			const jejak: string[] = [];
			(window as unknown as { __pelanggaranCsp: string[] }).__pelanggaranCsp = jejak;
			document.addEventListener('securitypolicyviolation', (peristiwa) => {
				jejak.push(`${peristiwa.violatedDirective} ${peristiwa.blockedURI}`);
			});
		});
		await bukaLembarKerja(page);

		const pelanggaran = await page.evaluate(
			() => (window as unknown as { __pelanggaranCsp: string[] }).__pelanggaranCsp
		);
		expect(pelanggaran).toEqual([]);
	});
});
