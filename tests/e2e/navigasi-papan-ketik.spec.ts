import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(1500);
	await tutupPanduan(page);
}

async function tekanTabSampai(
	page: Page,
	cocok: (teks: string) => boolean,
	batas = 45
): Promise<string | null> {
	for (let langkah = 0; langkah < batas; langkah += 1) {
		await page.keyboard.press('Tab');
		const teks = await page.evaluate(() =>
			(document.activeElement?.textContent ?? '').replace(/\s+/g, ' ').trim()
		);
		if (cocok(teks)) return teks;
	}
	return null;
}

test.describe('navigasi papan ketik dan padanan tabel', () => {
	test('alur utama dapat dijalankan tanpa tetikus sama sekali', async ({ page }) => {
		await bukaLembarKerja(page);

		expect(await tekanTabSampai(page, (teks) => teks === 'Daftar')).toBe('Daftar');
		await page.keyboard.press('Enter');
		await expect(page.getByText('Daftar segmen gang')).toBeVisible();

		const barisSegmen = await tekanTabSampai(page, (teks) => /^\d{4}\s+kelas/.test(teks), 30);
		expect(barisSegmen).not.toBeNull();
		await page.keyboard.press('Enter');

		const panelSegmen = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		await expect(panelSegmen).toBeVisible();
		await expect(panelSegmen).toContainText('Lebar minimum');

		const barisBangunan = await tekanTabSampai(
			page,
			(teks) => /^\d{5}\s+pilih bangunan/.test(teks),
			60
		);
		expect(barisBangunan).not.toBeNull();
		await page.keyboard.press('Enter');

		await expect(page.locator('aside section').filter({ hasText: 'Detail bangunan' })).toBeVisible();
	});

	test('pemilihan diumumkan lewat wilayah status untuk pembaca layar', async ({ page }) => {
		await bukaLembarKerja(page);

		expect(await tekanTabSampai(page, (teks) => teks === 'Daftar')).toBe('Daftar');
		await page.keyboard.press('Enter');
		const barisSegmen = await tekanTabSampai(page, (teks) => /^\d{4}\s+kelas/.test(teks), 30);
		expect(barisSegmen).not.toBeNull();
		await page.keyboard.press('Enter');

		const status = page.locator('[role="status"][aria-live="polite"]');
		await expect(status).toContainText('dipilih');
		await expect(status).toContainText('lebar minimum');
	});

	test('elemen yang mendapat fokus selalu punya garis fokus terlihat', async ({ page }) => {
		await bukaLembarKerja(page);
		for (let langkah = 0; langkah < 12; langkah += 1) {
			await page.keyboard.press('Tab');
			const terlihat = await page.evaluate(() => {
				const elemen = document.activeElement;
				if (!elemen || elemen === document.body) return true;
				const gaya = getComputedStyle(elemen);
				return gaya.outlineStyle !== 'none' && gaya.outlineWidth !== '0px';
			});
			expect(terlihat).toBe(true);
		}
	});

	test('kanvas overlay deck tidak menjadi perhentian tab', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.waitForTimeout(1500);
		const atribut = await page.evaluate(() => {
			const kanvas = document.querySelector('#deckgl-overlay');
			return {
				tabindex: kanvas?.getAttribute('tabindex'),
				ariaHidden: kanvas?.getAttribute('aria-hidden')
			};
		});
		expect(atribut).toEqual({ tabindex: '-1', ariaHidden: 'true' });
	});

	test('peta punya keterangan yang menunjuk ke padanan tabelnya', async ({ page }) => {
		await bukaLembarKerja(page);
		const keterangan = await page.evaluate(
			() => document.querySelector('[data-map-canvas] canvas')?.getAttribute('aria-label') ?? ''
		);
		expect(keterangan).toContain('tabel');
		expect(keterangan).toContain('Daftar');
	});

	test('saringan kelas mengubah isi tabel segmen', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Daftar', exact: true }).click();

		const tabel = page.locator('table').first();
		await expect(tabel).toBeVisible();

		await page.getByRole('button', { name: 'Unit besar', exact: true }).click();
		await page.waitForTimeout(400);
		await expect(page.getByText('segmen terpanjang pada kelas terpilih')).toBeVisible();
	});
});
