<script lang="ts">
	import { downloadStatus, dismissDownloadStatus } from '#lib/utils/download.svelte.js';

	function formatBytes(bytes: number): string {
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	let title = $derived.by(() => {
		const s = downloadStatus;
		switch (s.phase) {
			case 'fetching':
				return s.total === 1 ? '正在下載照片…' : `正在下載 ${s.done + s.failed} / ${s.total} 張`;
			case 'zipping':
				return '正在打包 ZIP…';
			case 'done':
				return s.failed > 0 ? `下載完成，${s.failed} 張失敗` : '下載完成';
			case 'error':
				return '下載失敗，請稍後再試';
			default:
				return '';
		}
	});

	let barPercent = $derived(
		downloadStatus.percent ??
			(downloadStatus.total > 0
				? ((downloadStatus.done + downloadStatus.failed) / downloadStatus.total) * 100
				: 0)
	);
	let busy = $derived(downloadStatus.phase === 'fetching' || downloadStatus.phase === 'zipping');
</script>

{#if downloadStatus.phase !== 'idle'}
	<div
		class="fixed right-4 bottom-4 z-[110] w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
		role="status"
		aria-live="polite"
	>
		<div class="flex items-center gap-2">
			{#if busy}
				<span
					class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
				></span>
			{:else if downloadStatus.phase === 'done' && downloadStatus.failed === 0}
				<span class="shrink-0 text-green-500">✓</span>
			{:else}
				<span class="shrink-0 text-destructive">!</span>
			{/if}
			<span class="flex-1 truncate text-sm font-medium">{title}</span>
			{#if !busy}
				<button
					class="text-muted-foreground hover:text-foreground"
					aria-label="關閉"
					onclick={dismissDownloadStatus}>✕</button
				>
			{/if}
		</div>
		{#if busy}
			<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-primary transition-[width] duration-200"
					style="width: {barPercent}%"
				></div>
			</div>
			<div class="mt-1 flex justify-between text-xs text-muted-foreground">
				<span>{formatBytes(downloadStatus.loadedBytes)}</span>
				<span>{Math.round(barPercent)}%</span>
			</div>
		{/if}
	</div>
{/if}
