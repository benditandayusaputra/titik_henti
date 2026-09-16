<script lang="ts">
	import { page } from '$app/state';

	interface SheetLink {
		href: string;
		label: string;
		index: string;
	}

	const sheets: SheetLink[] = [
		{ href: '/', label: 'Ringkasan', index: '01' },
		{ href: '/peta/', label: 'Lembar Kerja', index: '02' },
		{ href: '/kartu/', label: 'Kartu Siaga', index: '03' },
		{ href: '/metode/', label: 'Metode', index: '04' }
	];

	const currentPath = $derived(page.url.pathname);

	function matchesSheet(href: string): boolean {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<header class="bg-concrete-tint hairline-b sticky top-0 z-40 print:hidden">
	<div class="flex flex-wrap items-stretch">
		<a
			href="/"
			class="hairline-r group flex shrink-0 items-center gap-3 px-4 py-2.5 sm:px-5"
			aria-label="Titik Henti, beranda"
		>
			<span class="border-ink relative flex h-8 w-8 items-center justify-center border">
				<span class="bg-ink block h-[3px] w-[3px] rounded-full"></span>
				<span class="bg-ink absolute top-1/2 left-0 h-px w-3 -translate-y-1/2"></span>
				<span class="bg-alarm absolute right-[5px] bottom-[5px] h-[5px] w-[5px]"></span>
			</span>
			<span class="flex flex-col gap-[3px]">
				<span class="font-display text-ink text-[19px] leading-none font-bold tracking-[0.02em]">
					TITIK HENTI
				</span>
				<span class="stencil-sm text-graphite">Perencanaan siaga kebakaran gang</span>
			</span>
		</a>

		<nav class="hairline-r flex" aria-label="Lembar">
			{#each sheets as sheet (sheet.href)}
				{@const active = matchesSheet(sheet.href)}
				<a
					href={sheet.href}
					class="hairline-r flex flex-col justify-center gap-1 px-3 py-2 last:border-r-0 sm:px-4"
					class:bg-ink={active}
					aria-current={active ? 'page' : undefined}
				>
					<span
						class="stencil-sm"
						class:text-concrete={active}
						class:text-graphite-pale={!active}
						class:opacity-70={active}
					>
						{sheet.index}
					</span>
					<span
						class="font-display text-[12px] leading-none font-semibold tracking-[0.06em] uppercase"
						class:text-concrete={active}
						class:text-graphite={!active}
					>
						{sheet.label}
					</span>
				</a>
			{/each}
		</nav>

		<div class="ml-auto hidden flex-col justify-center gap-1 px-4 py-2 text-right lg:flex">
			<span class="stencil-sm text-graphite-pale">Status berkas</span>
			<span class="readout text-ink">REV 0.1 · PRA-RENCANA</span>
		</div>
	</div>
</header>
