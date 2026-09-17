<script lang="ts">
	import { page } from '$app/state';
	import {
		OG_IMAGE_HEIGHT,
		OG_IMAGE_PATH,
		OG_IMAGE_WIDTH,
		SITE_NAME,
		SITE_URL
	} from '$lib/domain/constants';

	interface Props {
		title: string;
		description: string;
		type?: 'website' | 'article';
	}

	let { title, description, type = 'website' }: Props = $props();

	const canonicalUrl = $derived(`${SITE_URL}${page.url.pathname}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="id_ID" />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={`${SITE_URL}${OG_IMAGE_PATH}`} />
	<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
	<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
