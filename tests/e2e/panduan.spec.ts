import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(1200);
}

const panduan = (page: Page) => page.getByRole('dialog', { name: /Lembar ini menjawab|Mulai dengan|Angkanya dibaca|Uji akibatnya|Bawa hasilnya/ });

test.describe('panduan pemakaian', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('muncul sendiri saat lembar kerja pertama dibuka', async ({ page }) => {
		await bukaLembarKerja(page);
		await expect(panduan(page)).toBeVisible();
		await expect(page.getByText('Panduan pemakaian, langkah')).toContainText('1/5');
	});

	test('lima langkah berurutan lalu menutup sendiri di langkah terakhir', async ({ page }) => {
		await bukaLembarKerja(page);
		for (const nomor of [1, 2, 3, 4]) {
			await expect(page.getByText('Panduan pemakaian, langkah')).toContainText(`${nomor}/5`);
			await page.getByRole('button', { name: 'Lanjut' }).click();
		}
		await expect(page.getByText('Panduan pemakaian, langkah')).toContainText('5/5');
		await page.getByRole('button', { name: 'Mulai pakai' }).click();
		await expect(panduan(page)).toBeHidden();
	});

	test('sorotan menutupi elemen yang sedang dijelaskan', async ({ page }) => {
		await bukaLembarKerja(page);
		const sorotan = page.locator('.border-ink.border-2').first();
		const peta = await page.locator('[data-panduan="peta"]').boundingBox();
		const kotakPeta = await sorotan.boundingBox();
		expect(Math.abs((kotakPeta?.y ?? 0) - (peta?.y ?? 0))).toBeLessThan(8);

		await page.getByRole('button', { name: 'Lanjut' }).click();
		await page.getByRole('button', { name: 'Lanjut' }).click();
		const tab = await page.locator('[data-panduan="tab"]').boundingBox();
		const kotakTab = await page.locator('.border-ink.border-2').first().boundingBox();
		expect(Math.abs((kotakTab?.y ?? 0) - (tab?.y ?? 0))).toBeLessThan(8);
	});

	test('tombol Escape dan tombol Lewati menutup panduan', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.keyboard.press('Escape');
		await expect(panduan(page)).toBeHidden();

		await page.getByRole('button', { name: 'Panduan' }).click();
		await expect(panduan(page)).toBeVisible();
		await page.getByRole('button', { name: 'Lewati' }).click();
		await expect(panduan(page)).toBeHidden();
	});

	test('tidak muncul lagi setelah ditutup dan pindah halaman', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Lewati' }).click();
		await page.getByRole('link', { name: 'Kartu siaga RT' }).click();
		await page.waitForTimeout(800);
		await page.getByRole('link', { name: 'Lembar kerja' }).click();
		await page.waitForTimeout(1500);
		await expect(panduan(page)).toBeHidden();
	});

	test('tidak menimbulkan pelanggaran aksesibilitas', async ({ page }) => {
		await bukaLembarKerja(page);
		const hasil = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(hasil.violations).toEqual([]);
	});
});

test.describe('panduan pemakaian di layar ponsel', () => {
	test.use({ viewport: devices['iPhone 13'].viewport, hasTouch: true, isMobile: true });

	test('sasaran langkah digulirkan ke layar, tidak tertutup panel', async ({ page }) => {
		await bukaLembarKerja(page);
		await page.getByRole('button', { name: 'Lanjut' }).click();
		await page.getByRole('button', { name: 'Lanjut' }).click();
		await page.waitForTimeout(500);

		const posisi = await page.evaluate(() => {
			const tab = document.querySelector('[data-panduan="tab"]')?.getBoundingClientRect();
			const panel = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
			if (!tab || !panel) return null;
			return { atasTab: tab.top, bawahTab: tab.bottom, atasPanel: panel.top, tinggiLayar: window.innerHeight };
		});
		expect(posisi).not.toBeNull();
		expect(posisi?.atasTab ?? -1).toBeGreaterThanOrEqual(0);
		expect(posisi?.bawahTab ?? Infinity).toBeLessThanOrEqual(posisi?.atasPanel ?? 0);
	});
});
