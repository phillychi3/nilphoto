<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import Lightbox from '$lib/components/Lightbox.svelte';

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
		albums?: Album[];
		tags?: Tag[];
		exif: {
			cameraMake: string | null;
			cameraModel: string | null;
			aperture: number | null;
			shutterSpeed: string | null;
			iso: number | null;
			focalLength: number | null;
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
	let selectMode = $state(false);

	// Add to album dialog
	let showAddAlbum = $state(false);
	let targetAlbumId = $state('');

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

	async function loadPhotos() {
		loading = true;
		currentPage = 1;
		try {
			const res = await fetch(`/api/photos?page=1&limit=${PAGE_SIZE}`);
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
			const res = await fetch(`/api/photos?page=${currentPage}&limit=${PAGE_SIZE}`);
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

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
		if (next.size > 0) selectMode = true;
	}

	function selectAll() {
		if (selectedIds.size === photos.length) {
			selectedIds = new Set();
			selectMode = false;
		} else {
			selectedIds = new Set(photos.map((p) => p.id));
			selectMode = true;
		}
	}

	function clearSelection() {
		selectedIds = new Set();
		selectMode = false;
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

	function getPhotoUrl(photo: { storagePath: string; thumbnailPath: string | null }, thumbnail = false): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}

	function handlePhotoClick(idx: number, photo: Photo) {
		if (selectMode) {
			toggleSelect(photo.id);
		} else {
			lightboxIndex = idx;
		}
	}
</script>

<svelte:head>
	<title>所有照片 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">所有照片</h1>
			<p class="text-sm text-muted-foreground">{totalPhotos} 張照片</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={selectAll}>
				{selectMode && selectedIds.size === photos.length ? '取消全選' : '全選'}
			</Button>
		</div>
	</div>

	<!-- Batch actions bar -->
	{#if selectedIds.size > 0}
		<div class="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
			<span class="text-sm font-medium">已選取 {selectedIds.size} 張</span>
			<Button variant="outline" size="sm" onclick={() => { targetAlbumId = albums[0]?.id || ''; showAddAlbum = true; }}>
				加入相簿
			</Button>
			<Button variant="outline" size="sm" class="text-destructive hover:text-destructive" onclick={batchDelete}>
				永久刪除
			</Button>
			<Button variant="ghost" size="sm" onclick={clearSelection}>取消</Button>
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if photos.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<p class="text-muted-foreground">目前沒有照片</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each photos as photo, idx}
				<button
					class="group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors {selectedIds.has(photo.id) ? 'border-primary' : 'border-transparent'}"
					onclick={() => handlePhotoClick(idx, photo)}
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
						class="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 {selectedIds.has(photo.id) ? 'border-primary bg-primary' : 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'}"
						role="checkbox"
						aria-checked={selectedIds.has(photo.id)}
						onclick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); toggleSelect(photo.id); } }}
					>
						{#if selectedIds.has(photo.id)}
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{/if}
					</div>
					<!-- Album badges -->
					{#if photo.albums && photo.albums.length > 0}
						<div class="absolute bottom-1 right-1 flex gap-0.5">
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
