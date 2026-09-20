import { expect, test, type Page } from '@playwright/test';

const HALAMAN_ANGKA = ['/', '/peta/', '/kartu/', '/metode/'];

async function tungguSiap(page: Page, jalur: string): Promise<void> {
	await page.goto(jalur);
	if (jalur === '/peta/') {
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat peta wilayah'),
			undefined,
			{ timeout: 60000 }
		);
		await page.waitForTimeout(2000);
	} else if (jalur === '/kartu/') {
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Menyusun kartu siaga RT'),
			undefined,
			{ timeout: 60000 }
		);
	} else {
		await page.waitForLoadState('networkidle');
	}
}

test.describe('halaman galat', () => {
	test('alamat yang tidak ada memakai halaman galat sendiri, berbahasa Indonesia', async ({
		page
	}) => {
		const jawaban = await page.goto('/alamat-yang-tidak-ada/');
		expect(jawaban?.status()).toBe(404);
		await expect(page).toHaveTitle(/Titik Henti/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			'Alamat ini tidak ada di Titik Henti'
		);
		await expect(page.getByRole('link', { name: 'Buka lembar kerja' })).toBeVisible();
		await expect(page.getByText('Not Found')).toBeHidden();
	});
});

test.describe('penulisan angka', () => {
	for (const jalur of HALAMAN_ANGKA) {
		test(`tidak ada desimal bertitik di ${jalur}`, async ({ page }) => {
			await tungguSiap(page, jalur);
			const pelanggaran = await page.evaluate(() => {
				const koordinat = /-?\d+\.\d{4,},\s*-?\d+\.\d{4,}/;
				const lisensiAtauVersi = /ODbL|CC BY|versi|v\d|Publikasi/i;
				const pemisahRibuan = /^\d{1,3}(\.\d{3})+$/;
				const temuan: string[] = [];
				const jalan = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
				let simpul = jalan.nextNode();
				while (simpul) {
					const teks = simpul.textContent ?? '';
					if (!koordinat.test(teks) && !lisensiAtauVersi.test(teks)) {
						for (const cocok of teks.matchAll(/\d+\.\d+/g)) {
							if (!pemisahRibuan.test(cocok[0])) temuan.push(cocok[0]);
						}
					}
					simpul = jalan.nextNode();
				}
				return temuan;
			});
			expect(pelanggaran, jalur).toEqual([]);
		});
	}
});

async function klikBangunan(page: Page): Promise<void> {
	for (let ulang = 0; ulang < 3; ulang += 1) {
		await page.getByRole('button', { name: /perbesar|zoom in/i }).click();
		await page.waitForTimeout(500);
	}
	await page.waitForTimeout(2000);
	const kanvas = await page.locator('.maplibregl-canvas').boundingBox();
	if (!kanvas) throw new Error('kanvas peta tidak ditemukan');
	const gambar = await page.screenshot({ clip: kanvas });
	const titik = await page.evaluate(async (dataUrl) => {
		const citra = new Image();
		citra.src = dataUrl;
		await citra.decode();
		const bantu = document.createElement('canvas');
		bantu.width = citra.width;
		bantu.height = citra.height;
		const konteks = bantu.getContext('2d');
		if (!konteks) return null;
		konteks.drawImage(citra, 0, 0);
		const piksel = konteks.getImageData(0, 0, bantu.width, bantu.height).data;
		const tapak = (x: number, y: number) => {
			const i = (y * bantu.width + x) * 4;
			return (
				Math.abs(piksel[i] - 44) < 5 && Math.abs(piksel[i + 1] - 44) < 5 && Math.abs(piksel[i + 2] - 52) < 5
			);
		};
		for (let jari = 0; jari < 400; jari += 3) {
			for (let sudut = 0; sudut < 360; sudut += 10) {
				const x = Math.round(bantu.width / 2 + jari * Math.cos((sudut * Math.PI) / 180));
				const y = Math.round(bantu.height / 2 + jari * Math.sin((sudut * Math.PI) / 180));
				let semua = true;
				for (let dx = -2; dx <= 2 && semua; dx += 2)
					for (let dy = -2; dy <= 2 && semua; dy += 2) semua = tapak(x + dx, y + dy);
				if (semua) return [x, y];
			}
		}
		return null;
	}, `data:image/png;base64,${gambar.toString('base64')}`);
	if (!titik) throw new Error('tapak bangunan tidak ditemukan di peta');
	await page.mouse.click(kanvas.x + titik[0], kanvas.y + titik[1]);
	await page.waitForTimeout(800);
}

test.describe('istilah hasil simulasi api', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('keadaan bangunan memakai satu nama dan tanpa baris yang selalu nol', async ({ page }) => {
		await tungguSiap(page, '/peta/');
		await page.getByRole('button', { name: 'Api', exact: true }).click();
		await page.getByRole('button', { name: 'Tetapkan titik api' }).click();
		await klikBangunan(page);
		await page.getByRole('button', { name: 'Jalankan', exact: true }).click();
		await page.waitForFunction(
			() => ![...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Menghitung'),
			undefined,
			{ timeout: 120000 }
		);
		await page.waitForTimeout(4000);

		const panel = page.getByRole('region', { name: 'Isi panel kerja' });
		const teks = (await panel.innerText()).slice((await panel.innerText()).indexOf('Hasil simulasi'));
		expect(teks).not.toContain('Terbakar penuh');
		expect(teks.match(/Sedang terbakar/g)?.length).toBe(2);
		expect(teks.match(/Habis terbakar/g)?.length).toBe(2);
		expect(teks).not.toMatch(/\bTerbakar\b(?! penuh)(?!\s)/);
	});
});

test.describe('angka besar di kartu siaga', () => {
	test('jumlah bangunan memakai pemisah ribuan', async ({ page }) => {
		await tungguSiap(page, '/kartu/');
		const angkaPolos = await page.evaluate(() => {
			const temuan: string[] = [];
			const jalan = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			let simpul = jalan.nextNode();
			while (simpul) {
				const teks = (simpul.textContent ?? '').trim();
				if (/^\d{4,}$/.test(teks)) temuan.push(teks);
				simpul = jalan.nextNode();
			}
			return temuan;
		});
		expect(angkaPolos).toEqual([]);
	});
});

test.describe('umpan balik dan legenda peta', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('hidran uji coba yang tidak menambah jangkauan dikatakan apa adanya', async ({ page }) => {
		await tungguSiap(page, '/peta/');
		await page.getByRole('button', { name: 'Air', exact: true }).click();
		await page.getByRole('button', { name: 'Taruh hidran uji coba' }).click();
		await klikBangunan(page);
		await expect(
			page.getByText(/Hidran uji coba (menambah|belum menambah)/)
		).toBeVisible({ timeout: 30000 });
	});

	test('legenda peta terbuka di layar lebar', async ({ page }) => {
		await tungguSiap(page, '/peta/');
		const legenda = page.locator('details').filter({ hasText: 'Kelas akses gang' });
		await expect(legenda.getByText('Unit besar')).toBeVisible();
	});
});

test.describe('legenda peta di layar ponsel', () => {
	test.use({ viewport: { width: 380, height: 740 } });

	test('legenda terlipat supaya peta tidak tertutup', async ({ page }) => {
		await tungguSiap(page, '/peta/');
		const legenda = page.locator('details').filter({ hasText: 'Kelas akses gang' });
		await expect(legenda).toBeVisible();
		await expect(legenda.getByText('Unit besar')).toBeHidden();
		await legenda.getByText('Kelas akses gang').click();
		await expect(legenda.getByText('Unit besar')).toBeVisible();
	});
});
