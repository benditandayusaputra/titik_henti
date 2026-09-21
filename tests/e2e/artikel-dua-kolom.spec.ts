import { expect, test, type Page } from '@playwright/test';

const BERGAMBAR = '/artikel/cara-memakai-apar/';

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

	test('setiap artikel punya ilustrasi beserta teks alternatifnya', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/artikel/');
		const alamat = await page
			.locator('a[href^="/artikel/"]')
			.evaluateAll((tautan) =>
				[...new Set(tautan.map((simpul) => simpul.getAttribute('href') ?? ''))].filter(
					(href) => href !== '/artikel/'
				)
			);
		expect(alamat.length).toBe(8);

		for (const href of alamat) {
			await page.goto(href);
			const gambar = page.locator('.lembar-samping figure img');
			await expect(gambar).toBeVisible();
			expect(((await gambar.getAttribute('alt')) ?? '').length).toBeGreaterThan(20);
		}
	});
});
