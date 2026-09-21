import { marked } from 'marked';
import { z } from '$lib/domain/zod';

export const ARTICLE_CATEGORIES = ['Sebelum', 'Saat', 'Sesudah'] as const;
export const ARTICLE_AUDIENCES = ['Warga', 'Pengurus RT', 'Relawan'] as const;
export const ARTICLE_MAP_CONDITIONS = [
	'gang_selang_saja',
	'gang_unit_kecil',
	'kantong_tak_terjangkau',
	'sumber_air_jauh'
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export type ArticleAudience = (typeof ARTICLE_AUDIENCES)[number];
export type ArticleMapCondition = (typeof ARTICLE_MAP_CONDITIONS)[number];

const sourceSchema = z.object({
	lembaga: z.string().min(1),
	tautan: z.string().url()
});

const frontmatterSchema = z.object({
	judul: z.string().min(1),
	ringkasan: z.string().min(1).max(200),
	kategori: z.enum(ARTICLE_CATEGORIES),
	untuk: z.array(z.enum(ARTICLE_AUDIENCES)).min(1),
	waktuBacaMenit: z.number().int().min(1).max(30),
	diperbarui: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	sumber: z.array(sourceSchema).min(1),
	berlakuUntuk: z.array(z.enum(ARTICLE_MAP_CONDITIONS)),
	gambarAlt: z.string().min(1).optional()
});

export type ArticleFrontmatter = z.infer<typeof frontmatterSchema>;

export interface Article extends ArticleFrontmatter {
	slug: string;
	html: string;
	htmlCetak: string;
	gambar?: string;
}

const CATEGORY_ORDER: Record<ArticleCategory, number> = {
	Saat: 0,
	Sebelum: 1,
	Sesudah: 2
};

function splitFrontmatter(raw: string, slug: string): { frontmatter: unknown; body: string } {
	const trimmed = raw.replace(/^﻿/, '').trimStart();
	if (!trimmed.startsWith('---')) {
		throw new Error(`artikel ${slug} tidak punya frontmatter`);
	}
	const closing = trimmed.indexOf('\n---', 3);
	if (closing === -1) throw new Error(`frontmatter artikel ${slug} tidak ditutup`);
	const header = trimmed.slice(3, closing).trim();
	const body = trimmed.slice(closing + 4).trim();
	try {
		return { frontmatter: JSON.parse(header), body };
	} catch {
		throw new Error(`frontmatter artikel ${slug} bukan JSON yang sah`);
	}
}

function readSlug(path: string): string {
	return path.split('/').pop()?.replace(/\.md$/, '') ?? path;
}

function buildArticles(): Article[] {
	const files = import.meta.glob('../../content/artikel/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	const printFiles = import.meta.glob('../../content/artikel/cetak/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	const printBodyBySlug = new Map(
		Object.entries(printFiles).map(([path, raw]) => [readSlug(path), raw])
	);
	const illustrationFiles = import.meta.glob('../ilustrasi/*.svg', {
		query: '?url',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	const illustrationBySlug = new Map(
		Object.entries(illustrationFiles).map(([path, url]) => [
			path.split('/').pop()?.replace(/\.svg$/, '') ?? path,
			url
		])
	);

	const articles: Article[] = [];
	for (const [path, raw] of Object.entries(files)) {
		const slug = readSlug(path);
		const { frontmatter, body } = splitFrontmatter(raw, slug);
		const parsed = frontmatterSchema.safeParse(frontmatter);
		if (!parsed.success) {
			throw new Error(
				`frontmatter artikel ${slug} tidak sesuai skema: ${parsed.error.issues
					.map((issue) => `${issue.path.join('.')} ${issue.message}`)
					.join('; ')}`
			);
		}
		const printBody = printBodyBySlug.get(slug);
		if (printBody === undefined) {
			throw new Error(`artikel ${slug} belum punya versi cetak di content/artikel/cetak`);
		}
		printBodyBySlug.delete(slug);
		const gambar = illustrationBySlug.get(slug);
		if (gambar !== undefined && parsed.data.gambarAlt === undefined) {
			throw new Error(`ilustrasi artikel ${slug} belum punya gambarAlt di frontmatter`);
		}
		articles.push({
			...parsed.data,
			slug,
			html: marked.parse(body, { async: false }),
			htmlCetak: marked.parse(printBody, { async: false }),
			gambar
		});
	}
	if (printBodyBySlug.size > 0) {
		throw new Error(`versi cetak tanpa artikel: ${[...printBodyBySlug.keys()].join(', ')}`);
	}

	articles.sort((first, second) => {
		const byCategory = CATEGORY_ORDER[first.kategori] - CATEGORY_ORDER[second.kategori];
		return byCategory !== 0 ? byCategory : first.judul.localeCompare(second.judul, 'id');
	});
	return articles;
}

export const articles: Article[] = buildArticles();

export function findArticle(slug: string): Article | undefined {
	return articles.find((article) => article.slug === slug);
}

export function filterArticles(
	all: Article[],
	kategori: ArticleCategory | null,
	untuk: ArticleAudience | null,
	pencarian: string
): Article[] {
	const kata = pencarian.trim().toLowerCase();
	return all.filter((article) => {
		if (kategori && article.kategori !== kategori) return false;
		if (untuk && !article.untuk.includes(untuk)) return false;
		if (!kata) return true;
		return (
			article.judul.toLowerCase().includes(kata) ||
			article.ringkasan.toLowerCase().includes(kata)
		);
	});
}

export function listArticlesForMapCondition(condition: ArticleMapCondition): Article[] {
	return articles.filter((article) => article.berlakuUntuk.includes(condition));
}
