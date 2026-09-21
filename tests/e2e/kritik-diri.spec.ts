import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const HALAMAN = ['/', '/kartu/', '/artikel/', '/artikel/tabung-gas-bocor/', '/metode/', '/peta/'];
const UKURAN_LAYAR = [
	{ width: 380, height: 800 },
	{ width: 768, height: 1024 },
	{ width: 1440, height: 900 }
];
const BATAS_LUAS_ALARM = 0.1;
const BATAS_MERAH_TAB_API_TANPA_API = 0.0005;
const WARNA_ALARM_RGB = 'rgb(214, 32, 42)';
const WARNA_INK_RGB = [26, 26, 28];

async function tungguHalamanSiap(page: Page, jalur: string): Promise<void> {
	await page.goto(jalur);
	if (jalur === '/peta/') {
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat peta wilayah'),
			undefined,
			{ timeout: 60000 }
		);
		await page.waitForTimeout(3000);
		await tutupPanduan(page);
	} else {
		await page.waitForLoadState('networkidle');
	}
}

async function hitungPangsaMerah(page: Page): Promise<number> {
	const gambar = await page.screenshot();
	return page.evaluate(async (dataUrl) => {
		const citra = new Image();
		citra.src = dataUrl;
		await citra.decode();
		const kanvas = document.createElement('canvas');
		kanvas.width = citra.width;
		kanvas.height = citra.height;
		const konteks = kanvas.getContext('2d');
		if (!konteks) return 1;
		konteks.drawImage(citra, 0, 0);
		const piksel = konteks.getImageData(0, 0, kanvas.width, kanvas.height).data;
		let merah = 0;
		for (let indeks = 0; indeks < piksel.length; indeks += 4) {
			const [r, g, b] = [piksel[indeks], piksel[indeks + 1], piksel[indeks + 2]];
			if (r > 70 && r > 1.8 * g && r > 1.8 * b) merah += 1;
		}
		return merah / (kanvas.width * kanvas.height);
	}, `data:image/png;base64,${gambar.toString('base64')}`);
}

test.describe('kritik diri dan pencabutan', () => {
	test('warna alarm tidak pernah menutupi lebih dari sepersepuluh layar', async ({ page }) => {
		test.setTimeout(240000);
		for (const ukuran of UKURAN_LAYAR) {
			await page.setViewportSize(ukuran);
			for (const jalur of HALAMAN) {
				await tungguHalamanSiap(page, jalur);
				const tinggiHalaman = await page.evaluate(() => document.scrollingElement?.scrollHeight ?? 0);
				for (let atas = 0; atas < tinggiHalaman; atas += ukuran.height) {
					await page.evaluate((y) => window.scrollTo(0, y), atas);
					await page.waitForTimeout(150);
					expect(await hitungPangsaMerah(page), `${jalur} ${ukuran.width} y=${atas}`).toBeLessThan(
						BATAS_LUAS_ALARM
					);
				}
			}
		}
	});

	test('tab api meredam merah kelas gang supaya merah hanya menandai api', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await tungguHalamanSiap(page, '/peta/');
		expect(await hitungPangsaMerah(page)).toBeGreaterThan(BATAS_MERAH_TAB_API_TANPA_API);

		await page.getByRole('button', { name: '2 Sebaran api', exact: true }).click();
		await page.waitForTimeout(1500);
		expect(await hitungPangsaMerah(page)).toBeLessThan(BATAS_MERAH_TAB_API_TANPA_API);
		await expect(page.getByText('Warna kelas diredam supaya merah hanya menandai api')).toBeVisible();
	});

	test('legenda peta berada di dalam layar pertama pada layar lebar', async ({ page }) => {
		for (const ukuran of [
			{ width: 1024, height: 768 },
			{ width: 1440, height: 900 }
		]) {
			await page.setViewportSize(ukuran);
			await tungguHalamanSiap(page, '/peta/');
			const legenda = await page.getByText('Kelas akses gang').boundingBox();
			expect(legenda, `${ukuran.width}`).not.toBeNull();
			expect((legenda?.y ?? Infinity) + (legenda?.height ?? 0)).toBeLessThanOrEqual(ukuran.height);
			expect(await page.evaluate(() => document.scrollingElement?.scrollHeight)).toBe(ukuran.height);
		}
	});

	test('angka ringkasan kartu siaga RT tidak saling bertumpuk di layar sempit', async ({ page }) => {
		await page.setViewportSize({ width: 380, height: 800 });
		await tungguHalamanSiap(page, '/kartu/');
		await page.waitForTimeout(2000);
		const tumpang = await page.evaluate(() => {
			const kotak = [...document.querySelectorAll('article .readout-lg')].map((elemen) => {
				const rentangTeks = document.createRange();
				rentangTeks.selectNodeContents(elemen);
				return rentangTeks.getBoundingClientRect();
			});
			let jumlah = 0;
			for (let i = 0; i < kotak.length; i += 1) {
				for (let j = i + 1; j < kotak.length; j += 1) {
					const [a, b] = [kotak[i], kotak[j]];
					if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) jumlah += 1;
				}
			}
			return { jumlah, angka: kotak.length };
		});
		expect(tumpang.angka).toBe(4);
		expect(tumpang.jumlah).toBe(0);
	});

	test('tidak ada titik tengah, hitam bersemu, atau merah hiasan di kepala halaman', async ({ page }) => {
		for (const jalur of HALAMAN.filter((jalur) => jalur !== '/peta/')) {
			await tungguHalamanSiap(page, jalur);
			const temuan = await page.evaluate(
				({ alarm, ink }) => {
					const hasil: string[] = [];
					if (document.body.innerText.includes('·')) hasil.push('titik tengah');
					for (const elemen of document.querySelectorAll('body *')) {
						const latar = getComputedStyle(elemen).backgroundColor.match(/\d+/g)?.map(Number);
						if (!latar || latar.length < 3 || latar[3] === 0) continue;
						const hitam = latar[0] < ink[0] && latar[1] < ink[1] && latar[2] < ink[2];
						if (hitam) hasil.push(`hitam bersemu pada ${elemen.className}`);
					}
					for (const elemen of document.querySelectorAll('header *')) {
						if (getComputedStyle(elemen).backgroundColor === alarm) hasil.push('merah di kepala halaman');
					}
					return hasil;
				},
				{ alarm: WARNA_ALARM_RGB, ink: WARNA_INK_RGB }
			);
			expect(temuan, jalur).toEqual([]);
		}
	});

	test('daftar batasan di halaman metode tidak diberi nomor karena bukan urutan', async ({ page }) => {
		await tungguHalamanSiap(page, '/metode/');
		const seksi = page.locator('section').filter({ hasText: 'Batasan yang harus dibaca lebih dulu' });
		await expect(seksi.locator('li').first()).not.toContainText(/^\s*0?1\b/);
	});

	test('monospasi di baris nilai panel hanya untuk angka terukur', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await tungguHalamanSiap(page, '/peta/');
		await page.getByRole('button', { name: 'Daftar', exact: true }).click();
		await page.getByRole('button', { name: /pilih bangunan ini/ }).first().click();
		await page.getByRole('button', { name: 'Akses', exact: true }).click();

		const hurufNilai = (label: string) =>
			page
				.locator('.ledger-row')
				.filter({ has: page.getByText(label, { exact: true }) })
				.first()
				.locator('span')
				.last()
				.evaluate((elemen) => getComputedStyle(elemen).fontFamily);

		for (const label of ['Tinggi', 'Luas tapak', 'Luas kelurahan']) {
			expect(await hurufNilai(label), label).toContain('Mono');
		}
		for (const label of ['Kelas material', 'Sumber tinggi', 'Bangunan terpetakan', 'Tak terlalui kendaraan']) {
			expect(await hurufNilai(label), label).not.toContain('Mono');
		}
	});
});
