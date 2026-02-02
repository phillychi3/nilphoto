<script lang="ts">
	import { onMount } from 'svelte';

	interface MenuItem {
		label: string;
		icon?: string;
		action: () => void;
		separator?: boolean;
		destructive?: boolean;
	}

	let {
		x = 0,
		y = 0,
		visible = $bindable(false),
		items = []
	}: {
		x: number;
		y: number;
		visible: boolean;
		items: MenuItem[];
	} = $props();

	let menuEl = $state<HTMLDivElement | null>(null);

	function handleClickOutside(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			visible = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') visible = false;
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Keep menu within viewport
	let adjustedX = $derived.by(() => {
		if (!menuEl) return x;
		const w = menuEl.offsetWidth || 180;
		return Math.min(x, window.innerWidth - w - 8);
	});

	let adjustedY = $derived.by(() => {
		if (!menuEl) return y;
		const h = menuEl.offsetHeight || 200;
		return Math.min(y, window.innerHeight - h - 8);
	});
</script>

{#if visible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={menuEl}
		class="fixed z-[100] min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg"
		style="left: {adjustedX}px; top: {adjustedY}px;"
	>
		{#each items as item}
			{#if item.separator}
				<div class="my-1 h-px bg-border"></div>
			{/if}
			<button
				class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent {item.destructive
					? 'text-destructive'
					: 'text-popover-foreground'}"
				onclick={() => {
					item.action();
					visible = false;
				}}
			>
				{#if item.icon}
					<span class="w-4 text-center">{item.icon}</span>
				{/if}
				{item.label}
			</button>
		{/each}
	</div>
{/if}
