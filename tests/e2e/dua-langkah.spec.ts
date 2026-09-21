import { devices, expect, test, type Page } from '@playwright/test';
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

const tabAktif = (page: Page) => page.locator('nav[aria-label="Panel kerja"] [aria-pressed="true"]');

test.describe('nav dua langkah', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('lembar kerja terbuka pada langkah titik henti, bukan pada telaah', async ({ page }) => {
		await bukaLembarKerja(page);
		await expect(tabAktif(page)).toHaveCount(1);
		await expect(tabAktif(page)).toHaveText('1 Titik henti');
		await expect(page.getByRole('heading', { name: 'Titik henti kendaraan' })).toBeVisible();
	});

	test('kedua langkah dan keempat telaah tetap dapat dijangkau', async ({ page }) => {
		await bukaLembarKerja(page);
		await expect(page.getByText('Telaah', { exact: true })).toBeVisible();

		for (const label of ['2 Sebaran api', 'Akses', 'Daftar', 'Air', 'Intervensi', '1 Titik henti']) {
			await page.getByRole('button', { name: label, exact: true }).click();
			await expect(tabAktif(page)).toHaveText(label);
		}
	});

	test('dua langkah mendahului baris telaah dalam urutan dokumen', async ({ page }) => {
		await bukaLembarKerja(page);
		const urutan = await page.evaluate(() => {
			const nav = document.querySelector('nav[aria-label="Panel kerja"]');
			if (!nav) return null;
			return Array.from(nav.querySelectorAll('button')).map((tombol) =>
				(tombol.textContent ?? '').trim()
			);
		});
		expect(urutan).toEqual([
			'1 Titik henti',
			'2 Sebaran api',
			'Akses',
			'Daftar',
			'Air',
			'Intervensi'
		]);
	});
});

test.describe('nav dua langkah di layar ponsel', () => {
	test.use({ viewport: devices['iPhone 13'].viewport, hasTouch: true, isMobile: true });

	test('baris telaah tidak menimbulkan gulir mendatar pada halaman', async ({ page }) => {
		await bukaLembarKerja(page);
		const selisih = await page.evaluate(() => {
			const akar = document.scrollingElement;
			return akar ? akar.scrollWidth - akar.clientWidth : -1;
		});
		expect(selisih).toBe(0);
	});
});
