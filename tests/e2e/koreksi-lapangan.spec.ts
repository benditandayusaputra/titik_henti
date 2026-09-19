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
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(1200);
}

const AREA_PETA = { x: 0, y: 60, width: 840, height: 640 };
const WARNA_GANG_UNIT_KECIL = { merah: 0xc9, hijau: 0x8a, biru: 0x14 };
const TOLERANSI_WARNA = 36;
const JARAK_ANTAR_SASARAN = 24;
const BATAS_SASARAN = 24;
const JEDA_TUNGGU_PANEL_MS = 600;

async function cariSasaranGangDiPeta(page: Page): Promise<{ x: number; y: number }[]> {
	const gambar = await page.screenshot({ clip: AREA_PETA });
	return page.evaluate(
		async ({ dataUrl, warna, toleransi, jarak, batas }) => {
			const citra = new Image();
			citra.src = dataUrl;
			await citra.decode();
			const kanvas = document.createElement('canvas');
			kanvas.width = citra.width;
			kanvas.height = citra.height;
			const konteks = kanvas.getContext('2d');
			if (!konteks) return [];
			konteks.drawImage(citra, 0, 0);
			const piksel = konteks.getImageData(0, 0, kanvas.width, kanvas.height).data;
			const sasaran: { x: number; y: number }[] = [];
			const selTerpakai = new Set<string>();
			for (let y = 0; y < kanvas.height && sasaran.length < batas; y += 2) {
				for (let x = 0; x < kanvas.width && sasaran.length < batas; x += 2) {
					const indeks = (y * kanvas.width + x) * 4;
					const cocok =
						Math.abs(piksel[indeks] - warna.merah) < toleransi &&
						Math.abs(piksel[indeks + 1] - warna.hijau) < toleransi &&
						Math.abs(piksel[indeks + 2] - warna.biru) < toleransi;
					const sel = `${Math.floor(x / jarak)}:${Math.floor(y / jarak)}`;
					if (cocok && !selTerpakai.has(sel)) {
						selTerpakai.add(sel);
						sasaran.push({ x, y });
					}
				}
			}
			return sasaran;
		},
		{
			dataUrl: `data:image/png;base64,${gambar.toString('base64')}`,
			warna: WARNA_GANG_UNIT_KECIL,
			toleransi: TOLERANSI_WARNA,
			jarak: JARAK_ANTAR_SASARAN,
			batas: BATAS_SASARAN
		}
	);
}

async function pilihSegmenGang(page: Page): Promise<void> {
	await expect
		.poll(async () => (await cariSasaranGangDiPeta(page)).length, { timeout: 60000 })
		.toBeGreaterThan(0);
	const panelSegmen = page.getByText('Segmen gang terpilih');
	for (const titik of await cariSasaranGangDiPeta(page)) {
		await page.mouse.click(AREA_PETA.x + titik.x, AREA_PETA.y + titik.y);
		const terpilih = await panelSegmen
			.waitFor({ state: 'visible', timeout: JEDA_TUNGGU_PANEL_MS })
			.then(() => true)
			.catch(() => false);
		if (terpilih) return;
	}
	throw new Error('tidak ada segmen gang yang terpilih dari klik pada garis gang yang tergambar');
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
		await expect(page.locator('#kalimat-koreksi')).toHaveValue('');

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

		await expect(
			page.getByRole('status').filter({ hasText: 'Jawaban layanan koreksi tidak dapat dibaca dan ditolak' })
		).toBeVisible();
		await expect(page.locator('article').filter({ hasText: 'Lebar usulan' })).toHaveCount(0);
		await expect(panel).toHaveText(sebelum ?? '');
	});

	test('kalimat tetap tersimpan dan pesan menyebut langkah berikutnya bila layanan gagal', async ({
		page
	}) => {
		await page.route('**/api/koreksi', (route) =>
			route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({
					ok: false,
					message: 'Layanan koreksi gagal merespons. Kalimat Anda tetap tersimpan, kirim ulang sebentar lagi.'
				})
			})
		);
		await bukaLembarKerja(page);
		await pilihSegmenGang(page);
		const kalimat = 'gang ini sebenarnya cuma dua meter karena ada warung permanen';
		await page.fill('#kalimat-koreksi', kalimat);
		await page.getByRole('button', { name: 'Buat usulan' }).click();

		await expect(page.getByText('kirim ulang sebentar lagi')).toBeVisible();
		await expect(page.locator('#kalimat-koreksi')).toHaveValue(kalimat);
		await expect(page.locator('article').filter({ hasText: 'Lebar usulan' })).toHaveCount(0);
	});

	test('kunci API tidak pernah sampai ke sisi klien', async ({ page, baseURL }) => {
		const asalSitus = new URL(baseURL ?? 'http://localhost').origin;
		const permintaanKeluar: string[] = [];
		page.on('request', (permintaan) => {
			const url = permintaan.url();
			if (new URL(url).origin !== asalSitus) permintaanKeluar.push(url);
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
