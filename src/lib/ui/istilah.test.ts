import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VARIAN_TERLARANG } from '$lib/ui/istilah';

const AKAR_TEKS_ANTARMUKA = [
	'src/routes',
	'src/lib/ui',
	'src/content',
	'src/lib/domain/constants.ts',
	'src/lib/workspace.svelte.ts',
	'src/lib/data/files/meta.json'
];
const EKSTENSI_DIPINDAI = new Set(['.svelte', '.ts', '.md', '.json']);
const BERKAS_DIKECUALIKAN = new Set(['istilah.ts', 'istilah.test.ts']);

function kumpulkanBerkas(jalur: string): string[] {
	if (statSync(jalur).isFile()) return [jalur];
	const hasil: string[] = [];
	for (const nama of readdirSync(jalur)) {
		const penuh = join(jalur, nama);
		if (statSync(penuh).isDirectory()) {
			hasil.push(...kumpulkanBerkas(penuh));
		} else if (EKSTENSI_DIPINDAI.has(extname(nama)) && !BERKAS_DIKECUALIKAN.has(nama)) {
			hasil.push(penuh);
		}
	}
	return hasil;
}

describe('satu benda satu nama', () => {
	it('tidak ada varian istilah terlarang di seluruh teks antarmuka dan artikel', () => {
		const temuan: string[] = [];
		for (const akar of AKAR_TEKS_ANTARMUKA) {
			for (const berkas of kumpulkanBerkas(akar)) {
				readFileSync(berkas, 'utf8')
					.split('\n')
					.forEach((baris, indeks) => {
						for (const varian of VARIAN_TERLARANG) {
							if (varian.pola.test(baris)) {
								temuan.push(
									`${berkas}:${indeks + 1} memakai ${varian.pola} padahal nama bakunya ${varian.gantiDengan}`
								);
							}
						}
					});
			}
		}
		expect(temuan).toEqual([]);
	});
});
