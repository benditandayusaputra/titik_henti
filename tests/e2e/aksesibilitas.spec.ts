import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const HALAMAN = [
	{ nama: 'beranda', jalur: '/' },
	{ nama: 'lembar kerja', jalur: '/peta/' },
	{ nama: 'kartu siaga', jalur: '/kartu/' },
	{ nama: 'daftar artikel', jalur: '/artikel/' },
	{ nama: 'artikel apar', jalur: '/artikel/cara-memakai-apar/' },
	{ nama: 'artikel tabung gas', jalur: '/artikel/tabung-gas-bocor/' },
	{ nama: 'artikel korsleting', jalur: '/artikel/korsleting-listrik/' },
	{ nama: 'artikel relawan', jalur: '/artikel/relawan-pemadam-kelurahan/' },
	{ nama: 'artikel menit pertama', jalur: '/artikel/menit-menit-pertama-saat-api-muncul/' },
	{ nama: 'artikel setelah padam', jalur: '/artikel/setelah-api-padam/' },
	{ nama: 'artikel jalur keluar', jalur: '/artikel/jalur-keluar-dan-titik-kumpul/' },
	{ nama: 'artikel mobil pemadam', jalur: '/artikel/saat-mobil-pemadam-tidak-bisa-masuk-gang/' },
	{ nama: 'metode', jalur: '/metode/' }
];

const LEBAR = [380, 768, 1024, 1440, 1920];
const TINGGI_PER_LEBAR: Record<number, number> = { 380: 820, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 };

test.describe('aksesibilitas dan tata letak', () => {
	for (const halaman of HALAMAN) {
		for (const lebar of LEBAR) {
			test(`${halaman.nama} pada ${lebar} piksel bebas pelanggaran dan tanpa gulir mendatar`, async ({
				page
			}) => {
				await page.setViewportSize({ width: lebar, height: TINGGI_PER_LEBAR[lebar] });
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
