import { expect, test } from '@playwright/test';

test.describe('beranda menyebut tujuannya', () => {
	test('kalimat pembuka menamai apa yang dikerjakan lembar ini', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');

		await expect(
			page.getByText(/mencari titik berhenti terdekat dari rumah yang terbakar/)
		).toBeVisible();
		await expect(page.getByText('Tandai rumah yang terbakar di peta.')).toBeVisible();
		await expect(
			page.getByText('Kirim koordinat titik hentinya ke sopir lewat Google Maps.')
		).toBeVisible();
	});

	test('tombol utama memakai nama tindakan yang sama dengan hasilnya', async ({ page }) => {
		await page.goto('/');
		const tombol = page.getByRole('link', { name: 'Cari titik henti' });

		await expect(tombol).toBeVisible();
		await expect(tombol).toHaveAttribute('href', '/peta/');
	});

	test('sebaran api disebut sebagai alat kedua yang terpisah', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText(/alat kedua yang terpisah/)).toBeVisible();
	});

	test('tabel pembanding akurasi tetap berdiri', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.getByRole('heading', { name: 'Seberapa akurat lebar gang di sini' })
		).toBeVisible();
		await expect(page.getByText('Permukiman sintetis')).toBeVisible();
	});

	test('daftar langkah tidak menimbulkan gulir mendatar di ponsel', async ({ page }) => {
		await page.setViewportSize({ width: 380, height: 800 });
		await page.goto('/');

		const selisih = await page.evaluate(() => {
			const akar = document.scrollingElement;
			return akar ? akar.scrollWidth - akar.clientWidth : -1;
		});
		expect(selisih).toBe(0);
	});
});
