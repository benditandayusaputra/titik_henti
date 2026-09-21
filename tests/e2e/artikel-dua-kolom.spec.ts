import { expect, test, type Page } from '@playwright/test';

const BERGAMBAR = '/artikel/cara-memakai-apar/';
const TANPA_GAMBAR = '/artikel/korsleting-listrik/';

const badan = (page: Page) => page.locator('.kolom-artikel > div').first();
const samping = (page: Page) => page.locator('.lembar-samping');

test.describe('artikel dua kolom', () => {
	test('di layar lebar sidebar berdiri di kanan badan dan ikut menggulir', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(BERGAMBAR);

		const kotakBadan = await badan(page).boundingBox();
		const kotakSamping = await samping(page).boundingBox();
		if (!kotakBadan || !kotakSamping) throw new Error('kolom tidak terukur');

		expect(kotakSamping.x).toBeGreaterThan(kotakBadan.x + kotakBadan.width - 1);
		expect(
			await samping(page).evaluate((simpul) => getComputedStyle(simpul).position)
		).toBe('sticky');
	});

	test('tepat di ambang 1024 piksel tidak ada gulir mendatar', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 900 });
		await page.goto(BERGAMBAR);

		const selisih = await page.evaluate(() => {
			const akar = document.scrollingElement;
			return akar ? akar.scrollWidth - akar.clientWidth : -1;
		});
		expect(selisih).toBe(0);
	});

	test('di ponsel kolom menumpuk jadi satu', async ({ page }) => {
		await page.setViewportSize({ width: 380, height: 800 });
		await page.goto(BERGAMBAR);

		const kotakBadan = await badan(page).boundingBox();
		const kotakSamping = await samping(page).boundingBox();
		if (!kotakBadan || !kotakSamping) throw new Error('kolom tidak terukur');

		expect(kotakSamping.y).toBeGreaterThan(kotakBadan.y);
	});

	test('ilustrasi punya teks alternatif dan hilang saat dicetak', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(BERGAMBAR);

		const gambar = page.locator('.lembar-samping figure img');
		await expect(gambar).toBeVisible();
		const alternatif = await gambar.getAttribute('alt');
		expect((alternatif ?? '').length).toBeGreaterThan(20);

		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.lembar-samping figure')).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Sumber' })).toBeVisible();
	});

	test('artikel tanpa ilustrasi tidak merender bingkai gambar', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(TANPA_GAMBAR);

		await expect(page.locator('.lembar-samping figure')).toHaveCount(0);
		await expect(samping(page)).toBeVisible();
	});
});
