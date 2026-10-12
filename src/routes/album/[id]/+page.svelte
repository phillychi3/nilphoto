<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import ContextMenu from '#lib/components/ContextMenu.svelte';
	import DragSelect from '#lib/components/DragSelect.svelte';
	import * as Drawer from '#lib/components/ui/drawer/index.js';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Check from '@lucide/svelte/icons/check';
	import { downloadPhotos } from '#lib/utils/download.js';

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
		url?: string;
		thumbnailUrl?: string | null;
		createdAt?: string;
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

	interface Tag {
		id: string;
		name: string;
	}

	type PhotoUpdate = {
		id: string;
		title: string | null;
		description?: string | null;
		originalFilename: string;
		tags?: Tag[];
	};

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
	let canEditPhotoInfo = $state(false);
	let loading = $state(true);
	let error = $state('');
	let lightboxIndex = $state(-1);

	const columnValues = [0, 3, 4, 5, 6, 7, 8] as const;
	let columnCount = $state(0); // 0 = auto
	let sliderIndex = $derived(
		Math.max(0, columnValues.indexOf(columnCount as (typeof columnValues)[number]))
	);
	let showDesktopPanel = $state(false);
	let showMobileDrawer = $state(false);
	let sortBy = $state<'default' | 'date-asc' | 'date-desc' | 'name'>('default');
	let activeTagIds = $state<Set<string>>(new Set());
	let tagMatchMode = $state<'all' | 'any'>('all');

	function setColumnFromSlider(index: number) {
		columnCount = columnValues[index];
		if (columnCount === 0) {
			localStorage.removeItem('nilphoto-columns');
		} else {
			localStorage.setItem('nilphoto-columns', String(columnCount));
		}
	}

	let selectedIds = $state<Set<string>>(new Set());
	let lastClickedIdx = $state(-1);

	let ctxVisible = $state(false);
	let ctxX = $state(0);
	let ctxY = $state(0);
	let ctxItems = $state<
		{
			label: string;
			action: () => void;
			separator?: boolean;
			destructive?: boolean;
		}[]
	>([]);

	let isSharedView = $derived(!!page.url.searchParams.get('token'));

	let selectMode = $derived(selectedIds.size > 0);

	onMount(async () => {
		const albumId = page.params.id;
		const token = page.url.searchParams.get('token');
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
			canEditPhotoInfo = data.canEditPhotoInfo ?? false;
		} catch {
			error = '載入失敗';
		} finally {
			loading = false;
		}

		const saved = localStorage.getItem('nilphoto-columns');
		if (saved) columnCount = parseInt(saved);
	});

	let columnStyle = $derived(columnCount === 0 ? '' : `column-count: ${columnCount}`);

	let columnClass = $derived(
		columnCount === 0 ? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4' : ''
	);

	let albumTags = $derived.by(() => {
		const deduped = new Map<string, Tag>();
		for (const photo of photos) {
			for (const tag of photo.tags || []) {
				if (!deduped.has(tag.id)) deduped.set(tag.id, tag);
			}
		}
		return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
	});

	let tagUsageCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const photo of photos) {
			for (const tag of photo.tags || []) {
				counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
			}
		}
		return counts;
	});

	let filteredPhotos = $derived.by(() => {
		if (activeTagIds.size === 0) return photos;
		const selected = [...activeTagIds];
		return photos.filter((photo) => {
			const photoTagIds = new Set(photo.tags?.map((tag) => tag.id));
			return tagMatchMode === 'all'
				? selected.every((id) => photoTagIds.has(id))
				: selected.some((id) => photoTagIds.has(id));
		});
	});

	function toggleTagFilter(id: string) {
		const next = new Set(activeTagIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		activeTagIds = next;
	}

	function getPhotoDate(photo: Photo): string {
		return photo.exif?.takenAt ?? photo.createdAt ?? '';
	}

	let sortedPhotos = $derived.by(() => {
		const arr = [...filteredPhotos];

		let sorted: Photo[];
		switch (sortBy) {
			case 'date-asc':
				sorted = arr.sort((a, b) => getPhotoDate(a).localeCompare(getPhotoDate(b)));
				break;
			case 'date-desc':
				sorted = arr.sort((a, b) => getPhotoDate(b).localeCompare(getPhotoDate(a)));
				break;
			case 'name':
				sorted = arr.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename));
				break;
			default:
				sorted = arr;
		}

		return sorted;
	});

	function getPhotoUrl(
		photo: {
			storagePath: string;
			thumbnailPath: string | null;
			url?: string;
			thumbnailUrl?: string | null;
		},
		thumbnail = false
	): string {
		if (thumbnail) {
			return photo.thumbnailUrl || `/uploads/${photo.thumbnailPath || photo.storagePath}`;
		}
		return photo.url || `/uploads/${photo.storagePath}`;
	}

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
		const visibleIds = sortedPhotos.map((photo) => photo.id);
		const allVisibleSelected =
			visibleIds.length > 0 && visibleIds.every((photoId) => selectedIds.has(photoId));
		if (allVisibleSelected) {
			clearSelection();
		} else {
			selectedIds = new Set(visibleIds);
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
				next.add(sortedPhotos[i].id);
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
			action: () => {
				lightboxIndex = idx;
			}
		});

		items.push({
			label: '下載',
			action: () => downloadSelected()
		});

		if (canEdit && !isSharedView) {
			items.push({
				label: '設為封面',
				action: () => setCover(photo.id),
				separator: true
			});

			items.push({
				label: selectedIds.size > 1 ? `刪除 ${selectedIds.size} 張` : '刪除',
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

	function handleDragSelection(ids: string[]) {
		if (ids.length > 0) {
			selectedIds = new Set(ids);
		}
	}

	function handlePhotoUpdated(updatedPhoto: PhotoUpdate) {
		photos = photos.map((photo) =>
			photo.id === updatedPhoto.id ? { ...photo, ...updatedPhoto } : photo
		);
	}

	$effect(() => {
		const stale = [...activeTagIds].filter((id) => !albumTags.some((tag) => tag.id === id));
		if (stale.length > 0) {
			activeTagIds = new Set([...activeTagIds].filter((id) => !stale.includes(id)));
		}
	});

	let panelContainerRef = $state<HTMLElement | null>(null);

	function handleWindowClick(e: MouseEvent) {
		if (showDesktopPanel && panelContainerRef && !panelContainerRef.contains(e.target as Node)) {
			showDesktopPanel = false;
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
			const idx = sortedPhotos.findIndex((p) => p.id === firstId);
			if (idx >= 0) lightboxIndex = idx;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

<svelte:head>
	<title>{album?.name || 'Album'} - {page.data.siteName}</title>
</svelte:head>

<ContextMenu bind:visible={ctxVisible} x={ctxX} y={ctxY} items={ctxItems} />
<DragSelect containerSelector=".photo-select-area" onSelectionChange={handleDragSelection} />

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
	<header class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
		<nav class="mx-auto flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-3">
				<h1 class="text-lg font-bold tracking-tight">{album.name}</h1>
				<span class="text-sm text-muted-foreground">
					{sortedPhotos.length}
					{#if activeTagIds.size > 0}
						/ {photos.length}
					{/if}
				</span>
			</div>
			<div class="relative" bind:this={panelContainerRef}>
				<button
					class="hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-accent md:flex {showDesktopPanel
						? 'border-primary text-primary'
						: 'border-border text-muted-foreground'}"
					onclick={() => (showDesktopPanel = !showDesktopPanel)}
				>
					<LayoutGrid size={14} />
					顯示設定
				</button>
				{#if showDesktopPanel}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border bg-popover p-0 shadow-xl"
						onclick={(e) => e.stopPropagation()}
					>
						<div class="px-4 pt-4 pb-2">
							<h3 class="text-sm font-semibold text-popover-foreground">檢視設定</h3>
						</div>

						<div class="px-4 pb-2">
							<p class="mb-1 text-xs text-muted-foreground">排序模式</p>
							{#each [{ value: 'date-desc', label: '最新優先', icon: '↓' }, { value: 'date-asc', label: '最早優先', icon: '↑' }, { value: 'name', label: '檔名排序', icon: 'A' }] as opt}
								<button
									class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
									onclick={() => {
										sortBy = opt.value as typeof sortBy;
									}}
								>
									<span class="w-4 text-center text-xs text-muted-foreground">{opt.icon}</span>
									<span class="flex-1 text-left">{opt.label}</span>
									{#if sortBy === opt.value}
										<Check size={16} />
									{/if}
								</button>
							{/each}
						</div>

						<div class="mx-4 border-t"></div>

						<div class="px-4 pt-3 pb-2">
							<p class="mb-1 text-xs text-muted-foreground">欄位設定</p>
							<input
								type="range"
								min="0"
								max="6"
								step="1"
								value={sliderIndex}
								oninput={(e) => setColumnFromSlider(parseInt(e.currentTarget.value))}
								class="my-2 w-full accent-primary"
							/>
							<div class="flex justify-between text-[10px] text-muted-foreground">
								{#each ['自動', '3', '4', '5', '6', '7', '8'] as label, i}
									<span class={sliderIndex === i ? 'font-bold text-primary' : ''}>{label}</span>
								{/each}
							</div>
						</div>

						<div class="border-t px-4 py-2 text-center text-sm text-muted-foreground">
							{columnCount === 0 ? '自動' : `${columnCount} 列`}
						</div>
					</div>
				{/if}

				<Drawer.Root bind:open={showMobileDrawer}>
					<Drawer.Trigger class="md:hidden">
						<button
							class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
						>
							<LayoutGrid size={14} />
							顯示設定
						</button>
					</Drawer.Trigger>
					<Drawer.Content class="md:hidden">
						<div class="mx-auto w-full max-w-md">
							<Drawer.Header>
								<Drawer.Title>檢視設定</Drawer.Title>
							</Drawer.Header>
							<div class="p-4 pb-8">
								<div class="mb-6">
									<p class="mb-2 text-sm font-medium">排序模式</p>
									<div class="space-y-1">
										{#each [{ value: 'date-desc', label: '最新優先', icon: '↓' }, { value: 'date-asc', label: '最早優先', icon: '↑' }, { value: 'name', label: '檔名排序', icon: 'A' }] as opt}
											<button
												class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent {sortBy ===
												opt.value
													? 'bg-accent'
													: ''}"
												onclick={() => {
													sortBy = opt.value as typeof sortBy;
												}}
											>
												<span class="w-4 text-center text-xs text-muted-foreground">{opt.icon}</span
												>
												<span class="flex-1 text-left">{opt.label}</span>
												{#if sortBy === opt.value}
													<Check size={18} />
												{/if}
											</button>
										{/each}
									</div>
								</div>

								<div>
									<p class="mb-2 text-sm font-medium">欄位設定</p>
									<input
										type="range"
										min="0"
										max="6"
										step="1"
										value={sliderIndex}
										oninput={(e) => setColumnFromSlider(parseInt(e.currentTarget.value))}
										class="my-3 w-full accent-primary"
									/>
									<div class="flex justify-between text-xs text-muted-foreground">
										{#each ['自動', '3', '4', '5', '6', '7', '8'] as label, i}
											<span class={sliderIndex === i ? 'font-bold text-foreground' : ''}
												>{label}</span
											>
										{/each}
									</div>
									<p class="mt-4 text-center text-sm">
										{columnCount === 0 ? '自動調整' : `${columnCount} 列顯示`}
									</p>
								</div>
							</div>
						</div>
					</Drawer.Content>
				</Drawer.Root>
			</div>
		</nav>
	</header>

	<div class="photo-select-area mx-auto px-4 py-4">
		{#if album.description}
			<p class="mb-4 text-muted-foreground">{album.description}</p>
		{/if}

		{#if albumTags.length > 0}
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<button
					class="rounded-full border px-3 py-1 text-sm transition-colors {activeTagIds.size > 0
						? 'border-border text-muted-foreground hover:bg-accent'
						: 'border-primary bg-primary/10 text-primary'}"
					onclick={() => (activeTagIds = new Set())}
				>
					全部
				</button>
				{#each albumTags as tag (tag.id)}
					<button
						class="rounded-full border px-3 py-1 text-sm transition-colors {activeTagIds.has(tag.id)
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border text-muted-foreground hover:bg-accent'}"
						onclick={() => toggleTagFilter(tag.id)}
					>
						{tag.name}
						<span class="ml-1 text-xs opacity-70">{tagUsageCounts.get(tag.id) || 0}</span>
					</button>
				{/each}
				{#if activeTagIds.size > 1}
					<div class="ml-auto flex overflow-hidden rounded-md border text-xs">
						<button
							class="px-2.5 py-1 transition-colors {tagMatchMode === 'all'
								? 'bg-primary/10 text-primary'
								: 'text-muted-foreground hover:bg-accent'}"
							onclick={() => (tagMatchMode = 'all')}
						>
							符合全部
						</button>
						<button
							class="border-l px-2.5 py-1 transition-colors {tagMatchMode === 'any'
								? 'bg-primary/10 text-primary'
								: 'text-muted-foreground hover:bg-accent'}"
							onclick={() => (tagMatchMode = 'any')}
						>
							符合任一
						</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if selectMode}
			<div
				class="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3"
			>
				<span class="text-sm font-medium">已選取 {selectedIds.size} 張</span>
				<button
					class="rounded-md border px-3 py-1 text-sm hover:bg-accent"
					onclick={selectAll}
				>
					{sortedPhotos.length > 0 && sortedPhotos.every((photo) => selectedIds.has(photo.id))
						? '取消全選'
						: '全選'}
				</button>
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
		{:else if sortedPhotos.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<p class="text-muted-foreground">目前沒有符合此 tag 的照片</p>
			</div>
		{:else}
			<div class="photo-grid {columnClass} gap-1" style={columnStyle}>
				{#each sortedPhotos as photo, idx (photo.id)}
					<button
						class="mb-1 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-lg border-2 transition-colors {selectedIds.has(
							photo.id
						)
							? 'border-primary'
							: 'border-transparent'}"
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
								class="absolute top-1.5 left-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 transition-opacity {selectedIds.has(
									photo.id
								)
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
									<Check size={12} color="white" strokeWidth={3} />
								{/if}
							</div>

							{#if album.coverPhotoId === photo.id}
								<div
									class="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
								>
									封面
								</div>
							{/if}

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

	<Lightbox
		photos={sortedPhotos}
		bind:index={lightboxIndex}
		canEdit={true}
		canEditMetadata={canEditPhotoInfo}
		{getPhotoUrl}
		onPhotoUpdated={handlePhotoUpdated}
	/>
{/if}
