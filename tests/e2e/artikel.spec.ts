import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const SLUG_CONTOH = 'cara-memakai-apar';
const JUMLAH_ARTIKEL = readdirSync('src/content/artikel').filter((nama) => nama.endsWith('.md')).length;

test.describe('artikel', () => {
	test('saringan mengubah URL dan tetap terpasang saat URL dibuka ulang', async ({
		page,
		context
	}) => {
		await page.goto('/artikel/');
		await page.waitForTimeout(800);
		await expect(page.getByText(`${JUMLAH_ARTIKEL} dari ${JUMLAH_ARTIKEL} artikel`)).toBeVisible();

		await page.getByRole('button', { name: 'Sebelum', exact: true }).click();
		await page.waitForTimeout(500);
		expect(page.url()).toContain('kategori=Sebelum');

		const jumlahTersaring = await page.getByText(new RegExp(`\\d+ dari ${JUMLAH_ARTIKEL} artikel`)).textContent();

		const halamanBaru = await context.newPage();
		await halamanBaru.goto(page.url());
		await halamanBaru.waitForTimeout(900);
		await expect(halamanBaru.getByText(jumlahTersaring ?? '')).toBeVisible();
		await expect(
			halamanBaru.getByRole('button', { name: 'Sebelum', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await halamanBaru.close();
	});

	test('pencarian menyaring di klien dan keadaan kosong mengajak menghapus saringan', async ({
		page
	}) => {
		await page.goto('/artikel/');
		await page.waitForTimeout(800);

		await page.fill('#cari-artikel', 'apar');
		await page.waitForTimeout(400);
		await expect(page.getByText(`1 dari ${JUMLAH_ARTIKEL} artikel`)).toBeVisible();

		await page.fill('#cari-artikel', 'kata yang tidak ada');
		await page.waitForTimeout(400);
		await expect(page.getByText('Hapus saringannya untuk melihat seluruh artikel.')).toBeVisible();

		await page.getByRole('button', { name: 'Hapus saringan' }).first().click();
		await page.waitForTimeout(500);
		await expect(page.getByText(`${JUMLAH_ARTIKEL} dari ${JUMLAH_ARTIKEL} artikel`)).toBeVisible();
	});

	test('setiap artikel menampilkan daftar sumber dan tanggal pembaruan', async ({ page }) => {
		await page.goto('/artikel/');
		await page.waitForTimeout(800);

		const tautan = await page.locator('a[href^="/artikel/"]').evaluateAll((elemen) =>
			elemen.map((item) => item.getAttribute('href') ?? '').filter((href) => href !== '/artikel/')
		);
		expect(tautan.length).toBeGreaterThan(0);

		for (const href of tautan) {
			await page.goto(href);
			await page.waitForTimeout(500);
			const sumber = page.locator('section').filter({ hasText: 'Sumber' });
			await expect(sumber).toBeVisible();
			await expect(sumber.locator('a[href^="http"]').first()).toBeVisible();
			await expect(sumber).toContainText('Diperbarui');
		}
	});

	test('mode cetak memunculkan ruang tulis dan menyembunyikan navigasi', async ({ page }) => {
		await page.goto(`/artikel/${SLUG_CONTOH}/`);
		await page.waitForTimeout(600);

		await page.emulateMedia({ media: 'print' });
		await page.waitForTimeout(400);

		const keadaan = await page.evaluate(() => {
			const ruang = document.querySelector('.ruang-tulis');
			const nav = document.querySelector('header');
			return {
				ruangTulisTampil: ruang ? getComputedStyle(ruang).display !== 'none' : false,
				jumlahGaris: document.querySelectorAll('.write-line').length,
				navTersembunyi: nav ? getComputedStyle(nav).display === 'none' : true
			};
		});

		expect(keadaan.ruangTulisTampil).toBe(true);
		expect(keadaan.jumlahGaris).toBeGreaterThan(0);
		expect(keadaan.navTersembunyi).toBe(true);

		await page.emulateMedia({ media: null });
	});

	test('memilih gang kelas selang saja memunculkan tautan artikel yang relevan', async ({
		page
	}) => {
		await page.goto('/peta/');
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat peta wilayah'),
			undefined,
			{ timeout: 60000 }
		);
		await page.waitForTimeout(1500);

		await page.getByRole('button', { name: 'Daftar', exact: true }).click();
		await page.waitForTimeout(600);
		await page.locator('table').first().locator('tbody tr').first().getByRole('button').click();
		await page.waitForTimeout(900);

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		await expect(panel).toContainText('Selang saja');
		await expect(panel.locator('a[href^="/artikel/"]').first()).toBeVisible();
	});
});
