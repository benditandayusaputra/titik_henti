import { read } from '$app/server';
import { DATA_URL } from '$lib/data/sources';
import type { PrintPlanDocument } from '$lib/data/printPlan';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '$lib/domain/constants';
import { encodePng, renderPlanImage } from '$lib/server/ogImage';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = async () => {
	const plan = (await read(DATA_URL.printPlan).json()) as PrintPlanDocument;
	const image = encodePng(renderPlanImage(plan, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT));
	return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } });
};
