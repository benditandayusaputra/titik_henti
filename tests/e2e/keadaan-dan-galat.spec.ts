import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WORKER_YANG_SENGAJA_GAGAL = `
self.onmessage = (event) => {
	if (event.data && event.data.kind === 'init') {
		self.postMessage({ kind: 'ready' });
		return;
	}
	throw new Error('kegagalan yang disengaja untuk pengujian');
};
`;

async function tungguPetaSiap(page: Page): Promise<void> {
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(1500);
}

async function tetapkanSatuTitikApi(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Api', exact: true }).click();
	await page.getByRole('button', { name: 'Tetapkan titik api' }).click();
	for (let y = 220; y <= 760; y += 30) {
		for (let x = 160; x <= 900; x += 30) {
			await page.mouse.click(x, y);
			await page.waitForTimeout(30);
			const kosongkanAktif = await page
				.getByRole('button', { name: 'Kosongkan', exact: true })
				.isEnabled();
			if (kosongkanAktif) return;
		}
	}
	throw new Error('tidak ada bangunan yang berhasil dijadikan titik api');
}

test.describe('keadaan memuat, kosong, dan gagal', () => {
	test('peta menjelaskan keadaan dan menawarkan artikel bila data wilayah gagal dimuat', async ({
		page
	}) => {
		await page.route('**/graph*.json', (route) => route.abort());
		await page.goto('/peta/');

		const penjelasan = page.getByRole('alert').filter({ hasText: 'Data wilayah belum tersedia' });
		await expect(penjelasan.first()).toBeVisible({ timeout: 30000 });
		await expect(penjelasan.first().getByRole('link', { name: 'Baca panduan siaga' })).toHaveAttribute(
			'href',
			'/artikel/'
		);
		await expect(penjelasan.first().getByRole('button', { name: 'Muat ulang data' })).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(1);
	});

	test('muat ulang data memulihkan peta setelah sambungan kembali', async ({ page }) => {
		let blokir = true;
		await page.route('**/graph*.json', (route) => (blokir ? route.abort() : route.continue()));
		await page.goto('/peta/');

		const tombolMuatUlang = page.getByRole('button', { name: 'Muat ulang data' }).first();
		await expect(tombolMuatUlang).toBeVisible({ timeout: 30000 });

		blokir = false;
		await tombolMuatUlang.click();
		await expect(page.getByText('Wilayah kerja')).toBeVisible({ timeout: 30000 });
	});

	test('kartu siaga tidak tertahan di keadaan memuat bila data gagal', async ({ page }) => {
		await page.route('**/graph*.json', (route) => route.abort());
		await page.goto('/kartu/');

		await expect(
			page.getByRole('alert').filter({ hasText: 'Data wilayah belum tersedia' }).first()
		).toBeVisible({ timeout: 30000 });
		await expect(page.getByRole('button', { name: 'Cetak lembar' })).toBeDisabled();
	});

	test('simulasi yang gagal menyebut penyebab dan menawarkan pengulangan dengan parameter awal', async ({
		page
	}) => {
		await page.route('**/fireSpread.worker*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'text/javascript',
				body: WORKER_YANG_SENGAJA_GAGAL
			})
		);
		await page.goto('/peta/');
		await tungguPetaSiap(page);
		await tetapkanSatuTitikApi(page);

		const tombolJalankan = page.getByRole('button', { name: 'Jalankan', exact: true });
		await expect(tombolJalankan).toBeEnabled({ timeout: 30000 });
		await tombolJalankan.click();

		const pesan = page.getByRole('alert').filter({ hasText: 'Perhitungan penjalaran api berhenti' });
		await expect(pesan).toBeVisible({ timeout: 15000 });
		await expect(pesan).toContainText('panel kalibrasi');
		await expect(pesan.getByRole('button', { name: 'Ulangi dengan parameter awal' })).toBeVisible();

		await expect(tombolJalankan).toBeEnabled();
	});

	test('tombol jalankan tidak bisa ditekan sebelum mesin simulasi siap', async ({ page }) => {
		await page.route('**/adjacency*.bin', () => undefined);
		await page.goto('/peta/');
		await tungguPetaSiap(page);
		await page.getByRole('button', { name: 'Api', exact: true }).click();

		await expect(page.getByRole('button', { name: 'Jalankan', exact: true })).toBeDisabled();
		await expect(page.getByText('Menyiapkan mesin simulasi dan data jarak antarbangunan')).toBeVisible();
	});

	for (const jalur of ['/peta/', '/kartu/']) {
		test(`keadaan data gagal di ${jalur} tetap bebas pelanggaran aksesibilitas`, async ({ page }) => {
			await page.route('**/graph*.json', (route) => route.abort());
			await page.goto(jalur);
			await expect(
				page.getByRole('alert').filter({ hasText: 'Data wilayah belum tersedia' }).first()
			).toBeVisible({ timeout: 30000 });

			const hasil = await new AxeBuilder({ page }).analyze();
			expect(hasil.violations).toEqual([]);
			await expect(page.locator('h1')).toHaveCount(1);
		});
	}

	test('tidak ada satu benda pun yang punya dua nama di teks tombol dan tautan', async ({ page }) => {
		const namaBaku: Record<string, RegExp> = {
			'Kartu siaga RT': /kartu siaga/i,
			'Lembar kerja': /lembar kerja/i,
			'Hidran uji coba': /hidran (?:usulan|uji coba|hipotetis|percobaan)/i
		};
		const teksTerkumpul: string[] = [];

		for (const jalur of ['/', '/peta/', '/kartu/', '/artikel/', '/metode/']) {
			await page.goto(jalur);
			await page.waitForTimeout(1500);
			const teks = await page
				.locator('button, a')
				.evaluateAll((elemen) =>
					elemen.map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
				);
			teksTerkumpul.push(...teks);
		}

		for (const [baku, pola] of Object.entries(namaBaku)) {
			const variasi = new Set(
				teksTerkumpul
					.map((teks) => teks.match(pola)?.[0])
					.filter((cocok): cocok is string => Boolean(cocok))
					.map((cocok) => cocok.toLowerCase())
			);
			expect([...variasi].every((nama) => baku.toLowerCase().includes(nama))).toBe(true);
		}
	});
});
