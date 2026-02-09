<script lang="ts">
	import AdminNav from '$lib/components/AdminNav.svelte';

	let { children } = $props();
</script>

<div class="mx-auto flex gap-6 px-4 py-4">
	<aside class="hidden w-48 shrink-0 md:block">
		<AdminNav />
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
