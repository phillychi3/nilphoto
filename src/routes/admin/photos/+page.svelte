<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import DragSelect from '$lib/components/DragSelect.svelte';
	import { downloadPhotos } from '$lib/utils/download';

	interface Album {
		id: string;
		name: string;
	}

	interface Tag {
		id: string;
		name: string;
	}

	interface Photo {
		id: string;
		filename: string;
		originalFilename: string;
		title: string | null;
		description: string | null;
		width: number | null;
		height: number | null;
		aspectRatio: number | null;
		storagePath: string;
		thumbnailPath: string | null;
		createdAt?: string;
		albums?: Album[];
		tags?: Tag[];
		exif: {
			cameraMake: string | null;
			cameraModel: string | null;
			lensModel?: string | null;
			aperture: number | null;
			shutterSpeed: string | null;
			iso: number | null;
			focalLength: number | null;
			focalLength35mm?: number | null;
			latitude?: number | null;
			longitude?: number | null;
			altitude?: number | null;
			takenAt?: string | null;
		} | null;
	}

	const PAGE_SIZE = 50;

	let photos = $state<Photo[]>([]);
	let albums = $state<Album[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(false);
	let currentPage = $state(1);
	let totalPhotos = $state(0);
	let lightboxIndex = $state(-1);

	// Selection
	let selectedIds = $state<Set<string>>(new Set());
	let lastClickedIdx = $state(-1);

	let selectMode = $derived(selectedIds.size > 0);

	// Add to album dialog
	let showAddAlbum = $state(false);
	let targetAlbumId = $state('');

	// Context menu
	let ctxVisible = $state(false);
	let ctxX = $state(0);
	let ctxY = $state(0);
	let ctxItems = $state<
		{
			label: string;
			icon?: string;
			action: () => void;
			separator?: boolean;
			destructive?: boolean;
		}[]
	>([]);

	// Search & filters
	let searchQuery = $state('');
	let showFilters = $state(false);
	let filterCamera = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let filterIsoMin = $state('');
	let filterIsoMax = $state('');
	let filterTag = $state('');
	let activeFilterCount = $derived(
		[filterCamera, filterDateFrom, filterDateTo, filterIsoMin, filterIsoMax, filterTag].filter(
			Boolean
		).length
	);
	let isSearching = $derived(!!searchQuery || activeFilterCount > 0);

	// Infinite scroll sentinel
	let sentinelEl = $state<HTMLDivElement | null>(null);
	let observer: IntersectionObserver | undefined;

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);

		Promise.all([loadPhotos(), loadAlbums()]);

		return () => observer!.disconnect();
	});

	$effect(() => {
		if (sentinelEl && observer) {
			observer.observe(sentinelEl);
			return () => observer!.unobserve(sentinelEl!);
		}
	});

	function buildSearchParams(page: number): string {
		const params = new URLSearchParams();
		params.set('page', String(page));
		params.set('limit', String(PAGE_SIZE));
		if (searchQuery.trim()) params.set('q', searchQuery.trim());
		if (filterCamera.trim()) params.set('camera', filterCamera.trim());
		if (filterDateFrom) params.set('dateFrom', filterDateFrom);
		if (filterDateTo) params.set('dateTo', filterDateTo);
		if (filterIsoMin) params.set('isoMin', filterIsoMin);
		if (filterIsoMax) params.set('isoMax', filterIsoMax);
		if (filterTag.trim()) params.set('tag', filterTag.trim());
		return params.toString();
	}

	async function loadPhotos() {
		loading = true;
		currentPage = 1;
		try {
			const res = await fetch(`/api/photos?${buildSearchParams(1)}`);
			const data = await res.json();
			photos = data.photos || [];
			hasMore = data.hasMore ?? false;
			totalPhotos = data.total ?? photos.length;
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			currentPage++;
			const res = await fetch(`/api/photos?${buildSearchParams(currentPage)}`);
			const data = await res.json();
			photos = [...photos, ...(data.photos || [])];
			hasMore = data.hasMore ?? false;
			totalPhotos = data.total ?? photos.length;
		} finally {
			loadingMore = false;
		}
	}

	async function loadAlbums() {
		try {
			const res = await fetch('/api/albums?includePrivate=true');
			const data = await res.json();
			albums = data.albums || [];
		} catch {
			// ignore
		}
	}

	function doSearch() {
		loadPhotos();
	}

	function clearFilters() {
		searchQuery = '';
		filterCamera = '';
		filterDateFrom = '';
		filterDateTo = '';
		filterIsoMin = '';
		filterIsoMax = '';
		filterTag = '';
		loadPhotos();
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function selectAll() {
		if (selectedIds.size === photos.length) {
			clearSelection();
		} else {
			selectedIds = new Set(photos.map((p) => p.id));
		}
	}

	function clearSelection() {
		selectedIds = new Set();
		lastClickedIdx = -1;
	}

	function handlePhotoClick(idx: number, photo: Photo, e: MouseEvent) {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			toggleSelect(photo.id);
			lastClickedIdx = idx;
			return;
		}
		if (e.shiftKey && lastClickedIdx >= 0) {
			e.preventDefault();
			const start = Math.min(lastClickedIdx, idx);
			const end = Math.max(lastClickedIdx, idx);
			const next = new Set(selectedIds);
			for (let i = start; i <= end; i++) {
				next.add(photos[i].id);
			}
			selectedIds = next;
			return;
		}
		if (selectMode) {
			toggleSelect(photo.id);
			lastClickedIdx = idx;
		} else {
			lightboxIndex = idx;
		}
	}

	function handleContextMenu(idx: number, photo: Photo, e: MouseEvent) {
		e.preventDefault();

		if (!selectedIds.has(photo.id)) {
			selectedIds = new Set([photo.id]);
			lastClickedIdx = idx;
		}

		const items: typeof ctxItems = [];

		items.push({
			label: '查看',
			icon: '🔍',
			action: () => {
				lightboxIndex = idx;
			}
		});

		items.push({
			label: '下載',
			icon: '⬇',
			action: () => downloadSelected()
		});

		items.push({
			label: '加入相簿',
			icon: '📁',
			action: () => {
				targetAlbumId = albums[0]?.id || '';
				showAddAlbum = true;
			},
			separator: true
		});

		items.push({
			label: selectedIds.size > 1 ? `刪除 ${selectedIds.size} 張` : '刪除',
			icon: '🗑',
			action: () => batchDelete(),
			destructive: true,
			separator: true
		});

		ctxItems = items;
		ctxX = e.clientX;
		ctxY = e.clientY;
		ctxVisible = true;
	}

	function getPhotoUrl(
		photo: { storagePath: string; thumbnailPath: string | null },
		thumbnail = false
	): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}

	function downloadSelected() {
		const photosToDownload = Array.from(selectedIds)
			.map((id) => {
				const photo = photos.find((p) => p.id === id);
				if (!photo) return null;
				return {
					id: photo.id,
					url: getPhotoUrl(photo),
					filename: photo.originalFilename
				};
			})
			.filter((p): p is NonNullable<typeof p> => p !== null);

		downloadPhotos(photosToDownload);
	}

	async function addToAlbum() {
		if (!targetAlbumId || selectedIds.size === 0) return;
		await fetch(`/api/albums/${targetAlbumId}/photos`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ photoIds: [...selectedIds] })
		});
		showAddAlbum = false;
		clearSelection();
		await loadPhotos();
	}

	async function batchDelete() {
		if (selectedIds.size === 0) return;
		if (!confirm(`確定要永久刪除 ${selectedIds.size} 張照片？`)) return;
		for (const id of selectedIds) {
			await fetch(`/api/photos/${id}`, { method: 'DELETE' });
		}
		clearSelection();
		await loadPhotos();
	}

	function handleDragSelection(ids: string[]) {
		if (ids.length > 0) {
			selectedIds = new Set(ids);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (
			(e.target as HTMLElement).tagName === 'INPUT' ||
			(e.target as HTMLElement).tagName === 'TEXTAREA'
		)
			return;

		if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
			e.preventDefault();
			selectAll();
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
			e.preventDefault();
			if (selectedIds.size > 0) downloadSelected();
		} else if (e.key === 'Escape') {
			clearSelection();
		} else if (e.key === 'Enter' && selectedIds.size > 0) {
			const firstId = [...selectedIds][0];
			const idx = photos.findIndex((p) => p.id === firstId);
			if (idx >= 0) lightboxIndex = idx;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>所有照片 - {page.data.siteName}</title>
</svelte:head>

<ContextMenu bind:visible={ctxVisible} x={ctxX} y={ctxY} items={ctxItems} />
<DragSelect containerSelector=".photo-grid" onSelectionChange={handleDragSelection} />

<div class="mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">所有照片</h1>
			<p class="text-sm text-muted-foreground">
				{#if isSearching}
					找到 {totalPhotos} 張照片
				{:else}
					{totalPhotos} 張照片
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={selectAll}>
				{selectMode && selectedIds.size === photos.length ? '取消全選' : '全選'}
			</Button>
		</div>
	</div>

	<!-- Search bar -->
	<div class="mb-4">
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				doSearch();
			}}
		>
			<div class="relative flex-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
				>
					<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
				</svg>
				<Input bind:value={searchQuery} placeholder="搜尋標題、描述、檔名..." class="pl-9" />
			</div>
			<Button type="submit" variant="outline">搜尋</Button>
			<Button
				type="button"
				variant={showFilters ? 'default' : 'outline'}
				onclick={() => (showFilters = !showFilters)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mr-1"
				>
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
				</svg>
				篩選
				{#if activeFilterCount > 0}
					<span
						class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] text-primary"
					>
						{activeFilterCount}
					</span>
				{/if}
			</Button>
		</form>

		<!-- Filter panel -->
		{#if showFilters}
			<div class="mt-3 rounded-lg border bg-card p-4">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div class="space-y-1.5">
						<Label for="filter-camera">相機 / 鏡頭</Label>
						<Input
							id="filter-camera"
							bind:value={filterCamera}
							placeholder="例如: Sony, Canon, 24-70..."
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="filter-tag">標籤</Label>
						<Input id="filter-tag" bind:value={filterTag} placeholder="標籤名稱" />
					</div>
					<div class="space-y-1.5">
						<Label>拍攝日期</Label>
						<div class="flex items-center gap-2">
							<input
								type="date"
								bind:value={filterDateFrom}
								class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
							/>
							<span class="text-muted-foreground">~</span>
							<input
								type="date"
								bind:value={filterDateTo}
								class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
							/>
						</div>
					</div>
					<div class="space-y-1.5">
						<Label>ISO 範圍</Label>
						<div class="flex items-center gap-2">
							<Input bind:value={filterIsoMin} placeholder="最小" type="number" />
							<span class="text-muted-foreground">~</span>
							<Input bind:value={filterIsoMax} placeholder="最大" type="number" />
						</div>
					</div>
				</div>
				<div class="mt-4 flex items-center gap-2">
					<Button size="sm" onclick={doSearch}>套用篩選</Button>
					{#if activeFilterCount > 0}
						<Button variant="ghost" size="sm" onclick={clearFilters}>清除全部</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Batch actions bar -->
	{#if selectedIds.size > 0}
		<div
			class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3"
		>
			<span class="text-sm font-medium">已選取 {selectedIds.size} 張</span>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						targetAlbumId = albums[0]?.id || '';
						showAddAlbum = true;
					}}
				>
					加入相簿
				</Button>
				<Button variant="outline" size="sm" onclick={downloadSelected}>下載</Button>
				<Button
					variant="outline"
					size="sm"
					class="text-destructive hover:text-destructive"
					onclick={batchDelete}
				>
					永久刪除
				</Button>
				<Button variant="ghost" size="sm" onclick={clearSelection}>取消</Button>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if photos.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			{#if isSearching}
				<p class="text-muted-foreground">找不到符合條件的照片</p>
				<Button variant="ghost" class="mt-2" onclick={clearFilters}>清除搜尋條件</Button>
			{:else}
				<p class="text-muted-foreground">目前沒有照片</p>
			{/if}
		</div>
	{:else}
		<div
			class="photo-grid grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
		>
			{#each photos as photo, idx}
				<button
					class="group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors {selectedIds.has(
						photo.id
					)
						? 'border-primary'
						: 'border-transparent'}"
					data-photo-id={photo.id}
					onclick={(e) => handlePhotoClick(idx, photo, e)}
					oncontextmenu={(e) => handleContextMenu(idx, photo, e)}
				>
					<img
						src={getPhotoUrl(photo, true)}
						alt={photo.title || photo.originalFilename}
						class="h-full w-full object-cover"
						loading="lazy"
					/>
					<!-- Selection checkbox -->
					<!-- svelte-ignore a11y_interactive_supports_focus -->
					<div
						class="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 {selectedIds.has(
							photo.id
						)
							? 'border-primary bg-primary'
							: 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'}"
						role="checkbox"
						aria-checked={selectedIds.has(photo.id)}
						onclick={(e) => {
							e.stopPropagation();
							toggleSelect(photo.id);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.stopPropagation();
								e.preventDefault();
								toggleSelect(photo.id);
							}
						}}
					>
						{#if selectedIds.has(photo.id)}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="white"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						{/if}
					</div>
					<!-- Album badges -->
					{#if photo.albums && photo.albums.length > 0}
						<div class="absolute right-1 bottom-1 flex gap-0.5">
							{#each photo.albums.slice(0, 2) as album}
								<span class="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
									{album.name}
								</span>
							{/each}
							{#if photo.albums.length > 2}
								<span class="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
									+{photo.albums.length - 2}
								</span>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Infinite scroll sentinel -->
		<div bind:this={sentinelEl} class="flex justify-center py-8">
			{#if loadingMore}
				<div class="text-sm text-muted-foreground">載入更多...</div>
			{:else if !hasMore}
				<div class="text-sm text-muted-foreground">已載入全部照片</div>
			{/if}
		</div>
	{/if}
</div>

<Lightbox {photos} bind:index={lightboxIndex} canEdit={true} {getPhotoUrl} />

<!-- Add to Album Dialog -->
<Dialog.Root bind:open={showAddAlbum}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>加入相簿</Dialog.Title>
			<Dialog.Description>將 {selectedIds.size} 張照片加入選定的相簿</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<select
				class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
				bind:value={targetAlbumId}
			>
				{#each albums as album}
					<option value={album.id}>{album.name}</option>
				{/each}
			</select>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showAddAlbum = false)}>取消</Button>
			<Button onclick={addToAlbum} disabled={!targetAlbumId}>加入</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
