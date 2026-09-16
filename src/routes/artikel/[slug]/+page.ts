import { error } from '@sveltejs/kit';
import { articles, findArticle } from '$lib/content/artikel';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => articles.map((article) => ({ slug: article.slug }));

export const load: PageLoad = ({ params }) => {
	const article = findArticle(params.slug);
	if (!article) error(404, 'Artikel tidak ditemukan');
	return { article };
};
