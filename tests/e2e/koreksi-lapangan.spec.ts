import { expect, test, type Page } from '@playwright/test';

const USULAN_TERSTRUKTUR = {
	ok: true,
	proposal: {
		segmentId: 0,
		proposedWidthMeters: 2,
		reason: 'Warung permanen di ujung gang menyempitkan lebar sisa.',
		confidence: 0.86
	}
};

async function bukaLembarKerja(page: Page): Promise<void> {
	await page.goto('/peta/');
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat berkas data'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(1200);
}

async function pilihSegmenGang(page: Page): Promise<void> {
	for (let y = 200; y <= 700; y += 25) {
		for (let x = 150; x <= 900; x += 25) {
			await page.mouse.click(x, y);
			await page.waitForTimeout(40);
			if (await page.getByText('Segmen gang terpilih').isVisible()) return;
		}
	}
	throw new Error('tidak ada segmen gang yang terpilih dari klik peta');
}

async function balasUsulan(page: Page): Promise<void> {
	await page.route('**/api/koreksi', async (route) => {
		const badan = route.request().postDataJSON() as { segment: { segmentId: number } };
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				ok: true,
				proposal: { ...USULAN_TERSTRUKTUR.proposal, segmentId: badan.segment.segmentId }
			})
		});
	});
}

test.describe('koreksi lapangan berbantuan AI', () => {
	test('segmen gang dapat diklik dan panelnya menampilkan lebar serta panjang', async ({ page }) => {
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		await expect(panel).toContainText('Lebar minimum');
		await expect(panel).toContainText('Lebar rata rata');
		await expect(panel).toContainText('Panjang segmen');
		await expect(panel).toContainText('Estimasi satelit');
	});

	test('kalimat bebas menghasilkan usulan terstruktur yang wajib disetujui manusia', async ({
		page
	}) => {
		await balasUsulan(page);
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		const sebelum = await panel.textContent();

		await page.fill('#kalimat-koreksi', 'gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await page.getByRole('button', { name: 'Buat usulan' }).click();

		const usulan = page.locator('article').filter({ hasText: 'Lebar usulan' });
		await expect(usulan).toBeVisible();
		await expect(usulan).toContainText('gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await expect(usulan).toContainText('2,00 m');

		await expect(panel).toHaveText(sebelum ?? '');
	});

	test('menyetujui usulan mengubah kelas akses dan menandai sumber nilai', async ({ page }) => {
		await balasUsulan(page);
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);

		await page.fill('#kalimat-koreksi', 'gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await page.getByRole('button', { name: 'Buat usulan' }).click();
		await page.getByRole('button', { name: 'Setujui' }).click();

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		await expect(panel).toContainText('Ukur lapangan');
		await expect(panel).toContainText('Selang saja');
		await expect(panel).toContainText('2,00 m');
	});

	test('menolak usulan mengembalikan nilai semula', async ({ page }) => {
		await balasUsulan(page);
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		const sebelum = await panel.textContent();

		await page.fill('#kalimat-koreksi', 'gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await page.getByRole('button', { name: 'Buat usulan' }).click();
		await page.getByRole('button', { name: 'Tolak' }).click();

		await expect(panel).toHaveText(sebelum ?? '');
		await expect(panel).toContainText('Estimasi satelit');
	});

	test('usulan yang tidak sesuai skema ditolak, bukan dipaksakan', async ({ page }) => {
		await page.route('**/api/koreksi', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, proposal: { segmentId: 1, reason: 'tanpa lebar' } })
			});
		});
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);

		const panel = page.locator('aside section').filter({ hasText: 'Segmen gang terpilih' });
		const sebelum = await panel.textContent();

		await page.fill('#kalimat-koreksi', 'gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await page.getByRole('button', { name: 'Buat usulan' }).click();

		await expect(page.getByRole('status')).toBeVisible();
		await expect(page.locator('article').filter({ hasText: 'Lebar usulan' })).toHaveCount(0);
		await expect(panel).toHaveText(sebelum ?? '');
	});

	test('kunci API tidak pernah sampai ke sisi klien', async ({ page }) => {
		const permintaanKeluar: string[] = [];
		page.on('request', (permintaan) => {
			const url = permintaan.url();
			if (!url.startsWith('http://localhost')) permintaanKeluar.push(url);
			if (permintaan.headers().authorization) permintaanKeluar.push(`berotorisasi ${url}`);
		});

		await balasUsulan(page);
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);
		await page.fill('#kalimat-koreksi', 'gang ini sebenarnya cuma dua meter karena ada warung permanen');
		await page.getByRole('button', { name: 'Buat usulan' }).click();
		await expect(page.locator('article').filter({ hasText: 'Lebar usulan' })).toBeVisible();

		expect(permintaanKeluar).toEqual([]);
	});
});
