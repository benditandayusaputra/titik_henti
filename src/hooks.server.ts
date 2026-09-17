import type { Handle } from '@sveltejs/kit';

const FIRST_SCREEN_FONT_FILES = [
	'ibm-plex-sans-condensed-latin-600-normal',
	'ibm-plex-sans-latin-400-normal',
	'ibm-plex-sans-latin-500-normal'
];

const ROUTE_TANPA_PRAMUAT_HURUF = '/peta';

export const handle: Handle = ({ event, resolve }) => {
	const halamanPeta = event.url.pathname.startsWith(ROUTE_TANPA_PRAMUAT_HURUF);
	return resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' ||
			type === 'css' ||
			(!halamanPeta &&
				type === 'font' &&
				path.endsWith('.woff2') &&
				FIRST_SCREEN_FONT_FILES.some((name) => path.includes(name)))
	});
};
