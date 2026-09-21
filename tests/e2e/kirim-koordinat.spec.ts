import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

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

const tautanNavigasi = (page: Page) => page.getByRole('link', { name: 'Buka di Google Maps' });

const koordinatTampil = (page: Page) =>
	page.locator('aside span').filter({ hasText: /^-?\d+\.\d{5}, -?\d+\.\d{5}$/ }).first();

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
			if (await tautanNavigasi(page).isVisible()) return;
		}
	}
	throw new Error('tidak menemukan bangunan yang punya titik henti sah');
}

test.describe('koordinat titik henti dikirim ke Google Maps', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('lembar kerja meminta menandai rumah yang terbakar sebelum apa pun dipilih', async ({
		page
	}) => {
		await bukaLembarKerja(page);
		await expect(page.getByText('Ketuk rumah yang terbakar', { exact: true })).toBeVisible();
		await pilihBangunanBertitikHenti(page);
		await expect(page.getByText('Ketuk rumah yang terbakar', { exact: true })).toBeHidden();
	});

	test('tautan menuju navigasi mobil ke koordinat yang sama dengan yang tampil', async ({
		page
	}) => {
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		const alamat = await tautanNavigasi(page).getAttribute('href');
		expect(alamat).toMatch(
			/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&travelmode=driving&dir_action=navigate&destination=-?\d+\.\d{5},-?\d+\.\d{5}$/
		);

		const tampil = ((await koordinatTampil(page).textContent()) ?? '').trim();
		expect(alamat).toContain(`destination=${tampil.replace(' ', '')}`);
		await expect(tautanNavigasi(page)).toHaveAttribute('target', '_blank');
		await expect(tautanNavigasi(page)).toHaveAttribute('rel', 'noreferrer');
	});

	test('tombol salin menaruh koordinat yang sama ke papan klip', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		const tampil = ((await koordinatTampil(page).textContent()) ?? '').trim();
		await page.getByRole('button', { name: 'Salin koordinat' }).click();

		await expect(page.getByText('Koordinat disalin.')).toBeVisible();
		const papanKlip = await page.evaluate(() => navigator.clipboard.readText());
		expect(papanKlip).toBe(tampil);
	});

	test('tanpa papan klip koordinat disorot dan pengguna diberi tahu caranya', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
		});
		await bukaLembarKerja(page);
		await pilihBangunanBertitikHenti(page);

		const tampil = ((await koordinatTampil(page).textContent()) ?? '').trim();
		await page.getByRole('button', { name: 'Salin koordinat' }).click();

		await expect(page.getByText(/Papan klip tidak tersedia/)).toBeVisible();
		const sorotan = await page.evaluate(() => (window.getSelection()?.toString() ?? '').trim());
		expect(sorotan).toBe(tampil);
	});
});
