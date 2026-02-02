<script lang="ts">
	let {
		containerSelector = '',
		itemSelector = '[data-photo-id]',
		onSelectionChange = (_ids: string[]) => {}
	}: {
		containerSelector?: string;
		itemSelector?: string;
		onSelectionChange?: (ids: string[]) => void;
	} = $props();

	let dragging = $state(false);
	let startX = $state(0);
	let startY = $state(0);
	let currentX = $state(0);
	let currentY = $state(0);

	let rectStyle = $derived.by(() => {
		if (!dragging) return '';
		const left = Math.min(startX, currentX);
		const top = Math.min(startY, currentY);
		const width = Math.abs(currentX - startX);
		const height = Math.abs(currentY - startY);
		return `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`;
	});

	function handleMouseDown(e: MouseEvent) {
		// Only left click, not on interactive elements
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('button, a, input, [role="checkbox"], [role="menu"]')) return;

		// Only start if clicking within the container area
		if (containerSelector) {
			const container = document.querySelector(containerSelector);
			if (!container || !container.contains(target)) return;
		}

		dragging = true;
		startX = e.clientX;
		startY = e.clientY;
		currentX = e.clientX;
		currentY = e.clientY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!dragging) return;
		currentX = e.clientX;
		currentY = e.clientY;
		updateSelection();
	}

	function handleMouseUp() {
		if (!dragging) return;
		dragging = false;
	}

	function updateSelection() {
		const selRect = {
			left: Math.min(startX, currentX),
			top: Math.min(startY, currentY),
			right: Math.max(startX, currentX),
			bottom: Math.max(startY, currentY)
		};

		// Minimum drag distance to avoid accidental selections
		if (selRect.right - selRect.left < 5 && selRect.bottom - selRect.top < 5) return;

		const items = document.querySelectorAll(itemSelector);
		const selected: string[] = [];
		items.forEach((el) => {
			const rect = el.getBoundingClientRect();
			if (
				rect.left < selRect.right &&
				rect.right > selRect.left &&
				rect.top < selRect.bottom &&
				rect.bottom > selRect.top
			) {
				const id = (el as HTMLElement).dataset.photoId;
				if (id) selected.push(id);
			}
		});
		onSelectionChange(selected);
	}
</script>

<svelte:window
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
/>

{#if dragging}
	<div
		class="pointer-events-none fixed z-50 border border-primary/50 bg-primary/10"
		style={rectStyle}
	></div>
{/if}
