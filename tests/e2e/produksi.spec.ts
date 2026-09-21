import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { tutupPanduan } from './bantu';

const ANGGARAN_JAVASCRIPT_BERANDA_KB = 180;
const ALAMAT_SITUS = 'https://titikhenti.vercel.app';
const HALAMAN = ['/', '/peta/', '/kartu/', '/artikel/', '/artikel/tabung-gas-bocor/', '/metode/'];
const POLA_BERKAS_DATA = /(graph|print)\.[\w-]+\.json$|\.bin$|\.pmtiles$/;

async function tungguPetaSiap(page: Page): Promise<void> {
	await page.waitForFunction(
		() => !document.body.textContent?.includes('Memuat peta wilayah'),
		undefined,
		{ timeout: 60000 }
	);
	await page.waitForTimeout(3000);
	await tutupPanduan(page);
}

test.describe('kinerja dan pengerasan produksi', () => {
	test('angka wilayah di beranda sudah ada di html hasil build', async ({ request }) => {
		const html = await (await request.get('/')).text();
		expect(html).toContain('Bangunan terpetakan');
		expect(html).toContain('12.764');
	});

	test('beranda tidak memuat berkas data dan javascript-nya di bawah anggaran', async ({ page }) => {
		const ukuranTerkompresi: number[] = [];
		const berkasData: string[] = [];
		page.on('response', async (response) => {
			const alamat = response.url();
			if (POLA_BERKAS_DATA.test(alamat)) berkasData.push(alamat);
			if (response.request().resourceType() === 'script') {
				ukuranTerkompresi.push(gzipSync(await response.body()).length);
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const totalKilobita = ukuranTerkompresi.reduce((jumlah, ukuran) => jumlah + ukuran, 0) / 1024;
		expect(berkasData).toEqual([]);
		expect(ukuranTerkompresi.length).toBeGreaterThan(0);
		expect(totalKilobita).toBeLessThan(ANGGARAN_JAVASCRIPT_BERANDA_KB);
	});

	test('berkas data peta dilayani dengan nama bersidik jari', async ({ page }) => {
		const berkasData: string[] = [];
		page.on('request', (request) => {
			if (POLA_BERKAS_DATA.test(request.url())) berkasData.push(new URL(request.url()).pathname);
		});
		await page.goto('/peta/');
		await tungguPetaSiap(page);

		expect(berkasData.length).toBeGreaterThanOrEqual(4);
		for (const jalur of berkasData) {
			expect(jalur).toMatch(/^\/_app\/immutable\/assets\/[a-z]+\.[\w-]{8}\.[a-z]+$/);
		}
	});

	test('hanya huruf layar pertama yang dimuat awal', async ({ request }) => {
		const html = await (await request.get('/artikel/')).text();
		const pramuat = html.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
		expect(pramuat).toHaveLength(3);
		for (const tautan of pramuat) expect(tautan).toContain('.woff2');
	});

	test('rute peta tidak memuat pustaka lapisan dan huruf di jalur kritis', async ({ request, page }) => {
		test.setTimeout(120000);
		const html = await (await request.get('/peta/')).text();
		expect(html.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? []).toHaveLength(0);

		const berkasTerpramuat = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/g)]
			.map((cocok) => cocok[0].match(/href="([^"]+)"/)?.[1] ?? '')
			.filter((jalur) => jalur.length > 0)
			.map((jalur) => jalur.replace(/^\.\.\//, '/'));
		expect(berkasTerpramuat.length).toBeGreaterThan(0);
		const berisiDeck = await Promise.all(
			berkasTerpramuat.map(async (jalur) => {
				const isi = await (await request.get(jalur)).text();
				return isi.includes('luma.gl');
			})
		);
		expect(berisiDeck.some(Boolean)).toBe(false);

		await page.goto('/peta/');
		await page.waitForFunction(
			() => !document.body.textContent?.includes('Memuat peta wilayah'),
			undefined,
			{ timeout: 60000 }
		);
		await expect(page.locator('.maplibregl-canvas')).toBeVisible();
	});

	test('setiap halaman punya kebijakan keamanan konten tanpa pelanggaran', async ({ page }) => {
		await page.addInitScript(() => {
			const jendela = window as unknown as { pelanggaranCsp: string[] };
			jendela.pelanggaranCsp = [];
			document.addEventListener('securitypolicyviolation', (event) => {
				jendela.pelanggaranCsp.push(`${event.violatedDirective} ${event.blockedURI}`);
			});
		});

		for (const jalur of HALAMAN) {
			await page.goto(jalur);
			if (jalur === '/peta/') await tungguPetaSiap(page);
			else await page.waitForLoadState('networkidle');

			const kebijakan = await page
				.locator('meta[http-equiv="content-security-policy"]')
				.getAttribute('content');
			expect(kebijakan, jalur).toContain("default-src 'self'");
			const pelanggaran = await page.evaluate(
				() => (window as unknown as { pelanggaranCsp: string[] }).pelanggaranCsp
			);
			expect(pelanggaran, jalur).toEqual([]);
		}
	});

	test('setiap halaman punya judul, deskripsi, dan open graph sendiri', async ({ request }) => {
		const judulTerpakai = new Set<string>();
		for (const jalur of HALAMAN) {
			const html = await (await request.get(jalur)).text();
			const judul = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
			expect(judul, jalur).toBeTruthy();
			judulTerpakai.add(judul ?? '');
			expect(html, jalur).toMatch(/<meta name="description" content="[^"]{40,}"/);
			expect(html, jalur).toContain(`<link rel="canonical" href="${ALAMAT_SITUS}${jalur}"`);
			expect(html, jalur).toContain(`<meta property="og:image" content="${ALAMAT_SITUS}/og.png"`);
		}
		expect(judulTerpakai.size).toBe(HALAMAN.length);
	});

	test('gambar open graph, peta situs, dan robots tersedia', async ({ request }) => {
		const gambar = await request.get('/og.png');
		expect(gambar.ok()).toBe(true);
		const isiGambar = await gambar.body();
		expect(isiGambar.subarray(1, 4).toString('ascii')).toBe('PNG');
		expect(isiGambar.readUInt32BE(16)).toBe(1200);
		expect(isiGambar.readUInt32BE(20)).toBe(630);

		const petaSitus = await (await request.get('/sitemap.xml')).text();
		for (const jalur of HALAMAN) expect(petaSitus).toContain(`<loc>${ALAMAT_SITUS}${jalur}</loc>`);

		const robots = await (await request.get('/robots.txt')).text();
		expect(robots).toContain(`Sitemap: ${ALAMAT_SITUS}/sitemap.xml`);
	});
});
