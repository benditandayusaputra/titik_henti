import { articles } from '$lib/content/artikel';
import { SITE_URL } from '$lib/domain/constants';
import type { RequestHandler } from './$types';

export const prerender = true;

const SHEET_PATHS = ['/', '/peta/', '/kartu/', '/artikel/', '/metode/'];

export const GET: RequestHandler = () => {
	const paths = [...SHEET_PATHS, ...articles.map((article) => `/artikel/${article.slug}/`)];
	const entries = paths.map((path) => `\t<url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
