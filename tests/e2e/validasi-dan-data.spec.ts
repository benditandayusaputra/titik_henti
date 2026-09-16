import { expect, test } from '@playwright/test';

test.describe('tabel validasi dan penandaan sumber data', () => {
	test('halaman metode menampilkan hasil uji sintetis lebih dulu', async ({ page }) => {
		await page.goto('/metode/');
		await page.waitForTimeout(1000);

		const seksi = page.locator('section').filter({ hasText: 'Seberapa akurat lebar gang di sini' });
		await expect(seksi).toBeVisible();
		await expect(seksi).toContainText('Lebar sebenarnya');
		await expect(seksi).toContainText('Lebar terukur');
		await expect(seksi).toContainText('Selisih');
		await expect(seksi).toContainText('Segmen terdeteksi');

		const seksiPertama = page.locator('section').first();
		await expect(seksiPertama).toContainText('Seberapa akurat lebar gang di sini');
	});

	test('tabel ukur lapangan menyatakan terus terang bila belum diisi', async ({ page }) => {
		await page.goto('/metode/');
		await page.waitForTimeout(1000);

		const seksi = page.locator('section').filter({ hasText: 'Uji kedua, ukur meteran di lapangan' });
		const isi = (await seksi.textContent()) ?? '';
		const belumDiisi = isi.includes('Belum dilakukan');
		if (belumDiisi) {
			expect(isi).toContain('belum pernah dibandingkan');
		} else {
			expect(isi).toContain('Ukur meteran');
			expect(isi).toContain('Keluaran pipeline');
		}
	});

	test('uji ketiga menyatakan angka kami sebagai batas atas, bukan bukti kebenaran', async ({
		page
	}) => {
		await page.goto('/metode/');
		await page.waitForTimeout(1000);

		const seksi = page.locator('section').filter({ hasText: 'Seberapa akurat lebar gang di sini' });
		await expect(seksi).toContainText('Uji ketiga, pembanding silang dengan OpenStreetMap');
		await expect(seksi).toContainText('Hasil ini tidak membuktikan angka kami benar');
		await expect(seksi).toContainText('batas atas');
		await expect(seksi).toContainText('kombinasi aturan');
	});

	test('sumber data beserta lisensinya disebut di antarmuka', async ({ page }) => {
		await page.goto('/metode/');
		await page.waitForTimeout(1200);

		const seksi = page.locator('section').filter({ hasText: 'Sumber data dan lisensi' });
		await expect(seksi).toContainText('Google Open Buildings');
		await expect(seksi).toContainText('CC BY 4.0');
		await expect(seksi).toContainText('OpenStreetMap');
		await expect(seksi).toContainText('ODbL 1.0');
	});

	test('penanda estimasi satelit tampil di lembar kerja', async ({ page }) => {
		await page.goto('/peta/');
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat berkas data'),
			undefined,
			{ timeout: 60000 }
		);
		await expect(page.getByText('estimasi citra satelit')).toBeVisible();
	});

	test('kartu siaga memuat catatan kaki sumber dan batasan', async ({ page }) => {
		await page.goto('/kartu/');
		await page.waitForTimeout(1500);
		const catatan = page.locator('footer');
		await expect(catatan).toContainText('Google Open Buildings');
		await expect(catatan).toContainText('bukan hasil ukur lapangan');
	});
});
