<script lang="ts">
	import {
		listArticlesForMapCondition,
		type Article,
		type ArticleMapCondition
	} from '$lib/content/artikel';

	interface Props {
		condition: ArticleMapCondition;
		lead: string;
	}

	let { condition, lead }: Props = $props();

	const terkait = $derived<Article[]>(listArticlesForMapCondition(condition));
</script>

{#if terkait.length > 0}
	<div class="hairline-t mt-3 pt-3">
		<p class="text-graphite text-[11.5px] leading-[1.55]">{lead}</p>
		<ul class="mt-2 flex flex-col gap-1.5">
			{#each terkait as artikel (artikel.slug)}
				<li>
					<a
						href="/artikel/{artikel.slug}/"
						class="text-ink text-[12px] leading-[1.5] underline underline-offset-2"
					>
						{artikel.judul}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
