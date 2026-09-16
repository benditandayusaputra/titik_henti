import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const HALAMAN = [
	{ nama: 'beranda', jalur: '/' },
	{ nama: 'lembar kerja', jalur: '/peta/' },
	{ nama: 'kartu siaga', jalur: '/kartu/' },
	{ nama: 'daftar artikel', jalur: '/artikel/' },
	{ nama: 'satu artikel', jalur: '/artikel/cara-memakai-apar/' },
	{ nama: 'metode', jalur: '/metode/' }
];

const LEBAR = [380, 768, 1440];

test.describe('aksesibilitas dan tata letak', () => {
	for (const halaman of HALAMAN) {
		for (const lebar of LEBAR) {
			test(`${halaman.nama} pada ${lebar} piksel bebas pelanggaran dan tanpa gulir mendatar`, async ({
				page
			}) => {
				await page.setViewportSize({ width: lebar, height: lebar === 380 ? 820 : 900 });
				await page.goto(halaman.jalur);
				await page.waitForFunction(
					() => !document.body.textContent?.includes('Memuat peta wilayah'),
					undefined,
					{ timeout: 60000 }
				);
				await page.waitForTimeout(1200);

				const hasil = await new AxeBuilder({ page }).analyze();
				expect(hasil.violations).toEqual([]);

				const selisih = await page.evaluate(() => {
					const elemen = document.scrollingElement;
					return elemen ? elemen.scrollWidth - elemen.clientWidth : 0;
				});
				expect(selisih).toBe(0);
			});
		}
	}

	test('setiap halaman punya tepat satu judul tingkat satu', async ({ page }) => {
		for (const halaman of HALAMAN) {
			await page.goto(halaman.jalur);
			await page.waitForTimeout(800);
			await expect(page.locator('h1')).toHaveCount(1);
		}
	});
});
