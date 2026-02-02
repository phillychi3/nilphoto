<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import DragSelect from '$lib/components/DragSelect.svelte';

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

	interface Album {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		shareToken: string | null;
		coverPhotoId?: string | null;
	}

	let album = $state<Album | null>(null);
	let photos = $state<Photo[]>([]);
	let canEdit = $state(false);
	let loading = $state(true);
	let error = $state('');
	let lightboxIndex = $state(-1);

	// Column count & display settings
	let columnCount = $state(0); // 0 = auto
	let showDisplayPanel = $state(false);
	let sortBy = $state<'default' | 'date-asc' | 'date-desc' | 'name'>('default');

	// Selection
	let selectedIds = $state<Set<string>>(new Set());
	let lastClickedIdx = $state(-1);

	// Context menu
	let ctxVisible = $state(false);
	let ctxX = $state(0);
	let ctxY = $state(0);
	let ctxItems = $state<{ label: string; icon?: string; action: () => void; separator?: boolean; destructive?: boolean }[]>([]);

	// Share mode detection
	let isSharedView = $derived(!!$page.url.searchParams.get('token'));

	let selectMode = $derived(selectedIds.size > 0);

	onMount(async () => {
		const albumId = $page.params.id;
		const token = $page.url.searchParams.get('token');
		const url = `/api/albums/${albumId}${token ? `?token=${token}` : ''}`;

		try {
			const res = await fetch(url);
			if (!res.ok) {
				const data = await res.json();
				error = data.error || '載入失敗';
				return;
			}
			const data = await res.json();
			album = data.album;
			photos = data.photos;
			canEdit = data.canEdit;
		} catch {
			error = '載入失敗';
		} finally {
			loading = false;
		}

		// Restore column preference
		const saved = localStorage.getItem('nilphoto-columns');
		if (saved) columnCount = parseInt(saved);
	});

	let columnClass = $derived(
		columnCount === 0
			? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4'
			: `columns-${columnCount}`
	);

	let sortedPhotos = $derived.by(() => {
		const arr = [...photos];
		switch (sortBy) {
			case 'date-asc':
				return arr.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
			case 'date-desc':
				return arr.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
			case 'name':
				return arr.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename));
			default:
				return arr;
		}
	});

	function getPhotoUrl(
		photo: { storagePath: string; thumbnailPath: string | null },
		thumbnail = false
	): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}

	// Selection logic
	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
		lastClickedIdx = -1;
	}

	function selectAll() {
		if (selectedIds.size === photos.length) {
			clearSelection();
		} else {
			selectedIds = new Set(photos.map((p) => p.id));
		}
	}

	function handlePhotoClick(idx: number, photo: Photo, e: MouseEvent) {
		if (e.ctrlKey || e.metaKey) {
			// Ctrl/Cmd + Click: toggle
			e.preventDefault();
			toggleSelect(photo.id);
			lastClickedIdx = idx;
			return;
		}
		if (e.shiftKey && lastClickedIdx >= 0) {
			// Shift + Click: range select
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

		// If right-clicked photo is not selected, select only it
		if (!selectedIds.has(photo.id)) {
			selectedIds = new Set([photo.id]);
			lastClickedIdx = idx;
		}

		const items: typeof ctxItems = [];

		items.push({
			label: '查看',
			icon: '🔍',
			action: () => { lightboxIndex = idx; }
		});

		items.push({
			label: '下載',
			icon: '⬇',
			action: () => downloadSelected()
		});

		if (canEdit && !isSharedView) {
			items.push({
				label: '設為封面',
				icon: '🖼',
				action: () => setCover(photo.id),
				separator: true
			});

			items.push({
				label: selectedIds.size > 1 ? `刪除 ${selectedIds.size} 張` : '刪除',
				icon: '🗑',
				action: () => deleteSelected(),
				destructive: true,
				separator: true
			});
		}

		ctxItems = items;
		ctxX = e.clientX;
		ctxY = e.clientY;
		ctxVisible = true;
	}

	async function setCover(photoId: string) {
		if (!album) return;
		const res = await fetch(`/api/albums/${album.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ coverPhotoId: photoId })
		});
		if (res.ok) {
			album = { ...album, coverPhotoId: photoId };
		}
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`確定要刪除 ${selectedIds.size} 張照片？`)) return;
		for (const id of selectedIds) {
			await fetch(`/api/photos/${id}`, { method: 'DELETE' });
		}
		photos = photos.filter((p) => !selectedIds.has(p.id));
		clearSelection();
	}

	function downloadSelected() {
		for (const id of selectedIds) {
			const photo = photos.find((p) => p.id === id);
			if (!photo) continue;
			const a = document.createElement('a');
			a.href = getPhotoUrl(photo);
			a.download = photo.originalFilename;
			a.click();
		}
	}

	function handleDragSelection(ids: string[]) {
		if (ids.length > 0) {
			selectedIds = new Set(ids);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		// Don't handle if typing in input
		if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

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
	<title>{album?.name || 'Album'} - NILPhoto</title>
</svelte:head>

<ContextMenu bind:visible={ctxVisible} x={ctxX} y={ctxY} items={ctxItems} />
<DragSelect containerSelector=".photo-grid" onSelectionChange={handleDragSelection} />

{#if loading}
	<div class="flex justify-center py-20">
		<div class="text-muted-foreground">載入中...</div>
	</div>
{:else if error}
	<div class="flex flex-col items-center justify-center py-20">
		<p class="text-destructive">{error}</p>
		<a href="/" class="mt-4 text-sm text-muted-foreground hover:text-foreground">返回首頁</a>
	</div>
{:else if album}
	<div class="mx-auto max-w-7xl px-4 py-8">
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<a href="/" class="text-sm text-muted-foreground hover:text-foreground">&larr; 返回</a>
				<div class="relative">
					<button
						class="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-accent {showDisplayPanel ? 'border-primary text-primary' : 'border-border text-muted-foreground'}"
						onclick={() => (showDisplayPanel = !showDisplayPanel)}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
						</svg>
						顯示設定
					</button>
					{#if showDisplayPanel}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="fixed inset-0 z-40" onclick={() => (showDisplayPanel = false)}></div>
						<div class="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border bg-popover p-0 shadow-xl">
							<div class="px-4 pt-4 pb-2">
								<h3 class="text-sm font-semibold text-popover-foreground">檢視設定</h3>
							</div>

							<!-- 排序模式 -->
							<div class="px-4 pb-2">
								<p class="mb-1 text-xs text-muted-foreground">排序模式</p>
								{#each [
									{ value: 'date-desc', label: '最新優先', icon: '↓' },
									{ value: 'date-asc', label: '最早優先', icon: '↑' },
									{ value: 'name', label: '檔名排序', icon: 'A' }
								] as opt}
									<button
										class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
										onclick={() => { sortBy = opt.value as typeof sortBy; }}
									>
										<span class="w-4 text-center text-xs text-muted-foreground">{opt.icon}</span>
										<span class="flex-1 text-left">{opt.label}</span>
										{#if sortBy === opt.value}
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="20 6 9 17 4 12" />
											</svg>
										{/if}
									</button>
								{/each}
							</div>

							<div class="mx-4 border-t"></div>

							<!-- 欄位設定 -->
							<div class="px-4 pt-3 pb-2">
								<p class="mb-1 text-xs text-muted-foreground">欄位設定</p>
								<div class="flex items-center justify-between text-xs text-muted-foreground">
									<span>自動</span>
									<span>8</span>
								</div>
								<input
									type="range"
									min="0"
									max="8"
									step="1"
									bind:value={columnCount}
									oninput={() => {
										if (columnCount === 1) columnCount = 2;
										if (columnCount === 0) {
											localStorage.removeItem('nilphoto-columns');
										} else {
											localStorage.setItem('nilphoto-columns', String(columnCount));
										}
									}}
									class="my-2 w-full accent-primary"
								/>
								<div class="flex justify-between text-[10px] text-muted-foreground">
									<span>自動</span>
									{#each [3, 4, 5, 6, 7, 8] as n}
										<span class={columnCount === n ? 'font-bold text-primary' : ''}>{n}</span>
									{/each}
								</div>
							</div>

							<!-- 底部顯示目前值 -->
							<div class="border-t px-4 py-2 text-center text-sm text-muted-foreground">
								{columnCount === 0 ? '自動' : `${columnCount} 列`}
							</div>
						</div>
					{/if}
				</div>
			</div>
			<h1 class="mt-4 text-3xl font-bold">{album.name}</h1>
			{#if album.description}
				<p class="mt-2 text-muted-foreground">{album.description}</p>
			{/if}
			<p class="mt-1 text-sm text-muted-foreground">{photos.length} 張圖片</p>
		</div>

		<!-- Batch actions bar -->
		{#if selectMode}
			<div class="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
				<span class="text-sm font-medium">已選取 {selectedIds.size} 張</span>
				<button
					class="rounded-md border px-3 py-1 text-sm hover:bg-accent"
					onclick={downloadSelected}
				>
					下載
				</button>
				{#if canEdit && !isSharedView}
					<button
						class="rounded-md border px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
						onclick={deleteSelected}
					>
						刪除
					</button>
				{/if}
				<button
					class="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
					onclick={clearSelection}
				>
					取消
				</button>
			</div>
		{/if}

		{#if photos.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<p class="text-muted-foreground">此相簿還沒有圖片</p>
			</div>
		{:else}
			<div class="photo-grid {columnClass} gap-4">
				{#each sortedPhotos as photo, idx}
					<button
						class="mb-4 block w-full cursor-zoom-in overflow-hidden rounded-lg break-inside-avoid border-2 transition-colors {selectedIds.has(photo.id) ? 'border-primary' : 'border-transparent'}"
						data-photo-id={photo.id}
						onclick={(e) => handlePhotoClick(idx, photo, e)}
						oncontextmenu={(e) => handleContextMenu(idx, photo, e)}
					>
						<div class="group relative">
							<img
								src={getPhotoUrl(photo, true)}
								alt={photo.title || photo.originalFilename}
								class="w-full object-cover transition-transform duration-300 group-hover:scale-105"
								style={photo.aspectRatio ? `aspect-ratio: ${photo.aspectRatio}` : ''}
								loading="lazy"
							/>
							<!-- Selection checkbox -->
							<!-- svelte-ignore a11y_interactive_supports_focus -->
							<div
								class="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 transition-opacity {selectedIds.has(photo.id)
									? 'border-primary bg-primary'
									: 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'}"
								role="checkbox"
								aria-checked={selectedIds.has(photo.id)}
								onclick={(e) => {
									e.stopPropagation();
									toggleSelect(photo.id);
									lastClickedIdx = idx;
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
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</div>
							<!-- Cover badge -->
							{#if album.coverPhotoId === photo.id}
								<div class="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
									封面
								</div>
							{/if}
							<!-- Hover overlay -->
							<div
								class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100"
							>
								{#if photo.title}
									<p class="text-sm font-medium text-white">{photo.title}</p>
								{/if}
								{#if photo.exif}
									<p class="text-xs text-white/70">
										{#if photo.exif.cameraModel}
											{photo.exif.cameraMake || ''} {photo.exif.cameraModel}
										{/if}
										{#if photo.exif.aperture}
											&middot; f/{photo.exif.aperture}
										{/if}
										{#if photo.exif.shutterSpeed}
											&middot; {photo.exif.shutterSpeed}
										{/if}
										{#if photo.exif.iso}
											&middot; ISO {photo.exif.iso}
										{/if}
									</p>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<Lightbox photos={sortedPhotos} bind:index={lightboxIndex} {canEdit} {getPhotoUrl} />
{/if}
