import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const HALAMAN = [
	'/',
	'/peta/',
	'/kartu/',
	'/artikel/',
	'/artikel/tabung-gas-bocor/',
	'/metode/'
];
const BATAS_LANGKAH_TAB = 80;
const JEDA_TRANSISI_FOKUS_MS = 250;
const KONTRAS_GARIS_FOKUS_MINIMUM = 3;
const JEDA_PENGGARIS_SELESAI_MS = 3000;
const PANJANG_SELANG_MINIMUM_UNTUK_UJI_METER = 40;

async function bukaHalaman(page: Page, jalur: string): Promise<void> {
	await page.goto(jalur);
	if (jalur === '/peta/') {
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat peta wilayah'),
			undefined,
			{ timeout: 60000 }
		);
		await page.waitForTimeout(2500);
		await tutupPanduan(page);
	} else {
		await page.waitForLoadState('networkidle');
	}
}

async function periksaFokusAktif(page: Page) {
	return page.evaluate(() => {
		const elemen = document.activeElement;
		if (!elemen || elemen === document.body) return null;
		const uraiWarna = (warna: string) => (warna.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
		const luminans = ([r, g, b]: number[]) => {
			const kanal = (nilai: number) => {
				const skala = nilai / 255;
				return skala <= 0.03928 ? skala / 12.92 : ((skala + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
		};
		const latarDi = (mulai: Element | null) => {
			for (let simpul = mulai; simpul; simpul = simpul.parentElement) {
				const warna = getComputedStyle(simpul).backgroundColor;
				if (warna !== 'rgba(0, 0, 0, 0)' && !warna.startsWith('rgba(0, 0, 0, 0')) return uraiWarna(warna);
			}
			return uraiWarna(getComputedStyle(document.body).backgroundColor);
		};
		const gaya = getComputedStyle(elemen);
		const offset = parseFloat(gaya.outlineOffset);
		const latar = offset >= 0 ? latarDi(elemen.parentElement) : latarDi(elemen);
		const [terang, gelap] = [luminans(uraiWarna(gaya.outlineColor)), luminans(latar)].sort(
			(a, b) => b - a
		);
		const kotak = elemen.getBoundingClientRect();
		const nama = `${elemen.tagName} ${(elemen.getAttribute('aria-label') ?? elemen.textContent ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 40)}`;
		return {
			kunci: `${nama}@${Math.round(kotak.x)},${Math.round(kotak.y)}`,
			nama,
			bergaris: gaya.outlineStyle !== 'none' && parseFloat(gaya.outlineWidth) >= 1,
			kontras: (terang + 0.05) / (gelap + 0.05),
			berukuran: kotak.width > 0 && kotak.height > 0
		};
	});
}

test.describe('definisi selesai keseluruhan', () => {
	test('setiap elemen yang difokus papan ketik punya garis fokus yang kontras', async ({ page }) => {
		test.setTimeout(300000);
		for (const lebar of [380, 1440]) {
			await page.setViewportSize({ width: lebar, height: 900 });
			for (const jalur of HALAMAN) {
				await bukaHalaman(page, jalur);
				const terlihat = new Set<string>();
				for (let langkah = 0; langkah < BATAS_LANGKAH_TAB; langkah += 1) {
					await page.keyboard.press('Tab');
					await page.waitForTimeout(JEDA_TRANSISI_FOKUS_MS);
					const fokus = await periksaFokusAktif(page);
					if (!fokus) continue;
					if (terlihat.has(fokus.kunci)) break;
					terlihat.add(fokus.kunci);
					const konteks = `${jalur} ${lebar} ${fokus.nama}`;
					expect(fokus.bergaris, konteks).toBe(true);
					expect(fokus.berukuran, konteks).toBe(true);
					expect(fokus.kontras, konteks).toBeGreaterThanOrEqual(KONTRAS_GARIS_FOKUS_MINIMUM);
				}
				expect(terlihat.size, `${jalur} ${lebar}`).toBeGreaterThan(0);
			}
		}
	});

	for (const gerak of ['reduce', 'no-preference'] as const) {
		test(`penggaris selang menghormati preferensi gerak ${gerak}`, async ({ browser }) => {
			test.setTimeout(180000);
			const konteks = await browser.newContext({
				viewport: { width: 1440, height: 900 },
				reducedMotion: gerak
			});
			const page = await konteks.newPage();
			await bukaHalaman(page, '/peta/');
			await page.waitForTimeout(1500);

			const angkaPenggaris = page.locator('.border-water .readout-lg');
			let sampel: number[] = [];
			pencarian: for (let y = 250; y <= 760; y += 35) {
				for (let x = 200; x <= 900; x += 35) {
					await page.evaluate(() => {
						const jendela = window as unknown as { sampelPenggaris: number[]; pencatat: number };
						jendela.sampelPenggaris = [];
						clearInterval(jendela.pencatat);
						jendela.pencatat = window.setInterval(() => {
							const teks = document.querySelector('.border-water .readout-lg')?.textContent;
							const nilai = teks ? Number.parseInt(teks, 10) : Number.NaN;
							if (Number.isFinite(nilai)) jendela.sampelPenggaris.push(nilai);
						}, 16);
					});
					await page.mouse.click(x, y);
					await page.waitForTimeout(80);
					if ((await angkaPenggaris.count()) === 0) continue;
					await page.waitForTimeout(JEDA_PENGGARIS_SELESAI_MS);
					sampel = await page.evaluate(
						() => (window as unknown as { sampelPenggaris: number[] }).sampelPenggaris
					);
					if (Math.max(...sampel) >= PANJANG_SELANG_MINIMUM_UNTUK_UJI_METER) break pencarian;
				}
			}

			expect(Math.max(0, ...sampel)).toBeGreaterThanOrEqual(PANJANG_SELANG_MINIMUM_UNTUK_UJI_METER);
			const nilaiBerbeda = new Set(sampel);
			if (gerak === 'reduce') {
				expect([...nilaiBerbeda]).toEqual([Math.max(...sampel)]);
			} else {
				expect(nilaiBerbeda.size).toBeGreaterThan(2);
			}

			const durasiTransisi = await page
				.getByRole('button', { name: 'Akses', exact: true })
				.evaluate((tombol) => parseFloat(getComputedStyle(tombol).transitionDuration));
			if (gerak === 'reduce') expect(durasiTransisi).toBeLessThan(0.01);
			else expect(durasiTransisi).toBeGreaterThan(0.05);
			await konteks.close();
		});
	}

	test('tabel pembanding akurasi lebar gang tampil di beranda', async ({ request }) => {
		const html = await (await request.get('/')).text();
		expect(html).toContain('Seberapa akurat lebar gang di sini');
		expect(html).toContain('Permukiman sintetis');
		expect(html).toContain('Ukur meteran lapangan');
		expect(html).toContain('OpenStreetMap');
		expect(html).toContain('href="/metode/"');
	});
});
