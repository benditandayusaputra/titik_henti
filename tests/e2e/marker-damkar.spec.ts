import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const MARKER = '[data-marker-titik-henti]';

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(3000);
	await tutupPanduan(page);
}

async function pilihBangunanBertitikHenti(page: Page): Promise<void> {
	const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
	if (!kanvas) throw new Error('kanvas peta tidak ditemukan');
	for (let baris = 3; baris <= 7; baris += 1) {
		for (let kolom = 3; kolom <= 7; kolom += 1) {
			await page.mouse.click(
				kanvas.x + (kanvas.width * kolom) / 10,
				kanvas.y + (kanvas.height * baris) / 10
			);
			await page.waitForTimeout(500);
			if (await page.locator(MARKER).isVisible()) return;
		}
	}
	throw new Error('tidak menemukan bangunan yang punya titik henti sah');
}

test.describe('marker mobil damkar di titik henti', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('muncul hanya setelah bangunan punya titik henti yang sah', async ({ page }) => {
		await bukaLembarKerja(page);
		await expect(page.locator(MARKER)).toBeHidden();

		await pilihBangunanBertitikHenti(page);
		await expect(page.locator(MARKER)).toBeVisible();
	});

	test('tetap di dalam kotak peta, tidak menimpa panel angka', async ({ page }) => {
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		const peta = await page.locator('[data-panduan="peta"]').boundingBox();
		const marker = await page.locator(MARKER).boundingBox();
		if (!peta || !marker) throw new Error('kotak peta atau marker tidak terukur');

		expect(marker.x).toBeGreaterThanOrEqual(peta.x - 1);
		expect(marker.x + marker.width).toBeLessThanOrEqual(peta.x + peta.width + 1);
		expect(marker.y).toBeGreaterThanOrEqual(peta.y - 1);
		expect(marker.y + marker.height).toBeLessThanOrEqual(peta.y + peta.height + 1);
	});

	test('ikut bergeser saat peta digeser', async ({ page }) => {
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		const sebelum = await page.locator(MARKER).boundingBox();
		const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
		if (!sebelum || !kanvas) throw new Error('kotak tidak terukur');

		await page.mouse.move(kanvas.x + kanvas.width / 2, kanvas.y + kanvas.height / 2);
		await page.mouse.down();
		await page.mouse.move(kanvas.x + kanvas.width / 2 - 90, kanvas.y + kanvas.height / 2, {
			steps: 12
		});
		await page.mouse.up();
		await page.waitForTimeout(800);

		const sesudah = await page.locator(MARKER).boundingBox();
		if (!sesudah) throw new Error('marker hilang setelah peta digeser');
		expect(Math.abs(sesudah.x - sebelum.x)).toBeGreaterThan(40);
	});

	test('tidak diumumkan pembaca layar karena koordinatnya sudah ada di panel', async ({ page }) => {
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		await expect(page.locator(MARKER)).toHaveAttribute('aria-hidden', 'true');
		await expect(page.getByText('Koordinat titik henti')).toBeVisible();
	});
});
