<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Photo {
		id: string;
		thumbnailPath: string | null;
		storagePath: string;
		title: string | null;
		originalFilename: string;
		photoTags?: { tag: { id: string; name: string } }[];
	}

	interface Album {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		isSystem: boolean;
		coverPhotoId: string | null;
		shareToken: string | null;
		createdAt: string;
	}

	interface Tag {
		id: string;
		name: string;
	}

	let albums = $state<Album[]>([]);
	let loading = $state(true);

	// Create dialog
	let showCreate = $state(false);
	let newName = $state('');
	let newDescription = $state('');
	let newIsPublic = $state(false);
	let creating = $state(false);

	// Delete dialog
	let showDelete = $state(false);
	let deleteTarget = $state<Album | null>(null);
	let deleting = $state(false);

	// Album detail / photo management
	let selectedAlbum = $state<Album | null>(null);
	let albumPhotos = $state<Photo[]>([]);
	let selectedPhotoIds = $state<Set<string>>(new Set());
	let loadingPhotos = $state(false);

	// Tags
	let allTags = $state<Tag[]>([]);
	let showTagDialog = $state(false);
	let selectedTagIds = $state<Set<string>>(new Set());
	let newTagName = $state('');

	onMount(async () => {
		await loadAlbums();
		await loadTags();
	});

	async function loadAlbums() {
		loading = true;
		try {
			const res = await fetch('/api/albums?includePrivate=true');
			const data = await res.json();
			albums = data.albums;
		} finally {
			loading = false;
		}
	}

	async function loadTags() {
		try {
			const res = await fetch('/api/tags');
			if (res.ok) {
				const data = await res.json();
				allTags = data.tags;
			}
		} catch {
			// ignore
		}
	}

	async function createAlbum() {
		if (!newName.trim()) return;
		creating = true;
		try {
			const res = await fetch('/api/albums', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newName.trim(),
					description: newDescription.trim() || null,
					isPublic: newIsPublic
				})
			});
			if (res.ok) {
				showCreate = false;
				newName = '';
				newDescription = '';
				newIsPublic = false;
				await loadAlbums();
			}
		} finally {
			creating = false;
		}
	}

	async function togglePublic(album: Album) {
		if (album.isSystem) return;
		await fetch(`/api/albums/${album.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isPublic: !album.isPublic })
		});
		await loadAlbums();
	}

	function confirmDelete(album: Album) {
		deleteTarget = album;
		showDelete = true;
	}

	async function executeDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			const deletedId = deleteTarget.id;
			await fetch(`/api/albums/${deletedId}`, { method: 'DELETE' });
			showDelete = false;
			deleteTarget = null;
			if (selectedAlbum?.id === deletedId) {
				selectedAlbum = null;
				albumPhotos = [];
			}
			await loadAlbums();
		} finally {
			deleting = false;
		}
	}

	async function openAlbumDetail(album: Album) {
		selectedAlbum = album;
		selectedPhotoIds = new Set();
		await loadAlbumPhotos(album.id);
	}

	async function loadAlbumPhotos(albumId: string) {
		loadingPhotos = true;
		try {
			const res = await fetch(`/api/albums/${albumId}`);
			const data = await res.json();
			albumPhotos = data.photos || [];
		} finally {
			loadingPhotos = false;
		}
	}

	function togglePhotoSelect(photoId: string) {
		const next = new Set(selectedPhotoIds);
		if (next.has(photoId)) {
			next.delete(photoId);
		} else {
			next.add(photoId);
		}
		selectedPhotoIds = next;
	}

	function selectAllPhotos() {
		if (selectedPhotoIds.size === albumPhotos.length) {
			selectedPhotoIds = new Set();
		} else {
			selectedPhotoIds = new Set(albumPhotos.map((p) => p.id));
		}
	}

	// Batch delete photos from album (removes link, not the photo itself)
	async function batchRemoveFromAlbum() {
		if (!selectedAlbum || selectedPhotoIds.size === 0) return;
		await fetch(`/api/albums/${selectedAlbum.id}/photos`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ photoIds: [...selectedPhotoIds] })
		});
		selectedPhotoIds = new Set();
		await loadAlbumPhotos(selectedAlbum.id);
	}

	// Batch delete photos permanently
	async function batchDeletePhotos() {
		if (selectedPhotoIds.size === 0) return;
		if (!confirm(`確定要永久刪除 ${selectedPhotoIds.size} 張照片？此操作無法復原。`)) return;
		for (const id of selectedPhotoIds) {
			await fetch(`/api/photos/${id}`, { method: 'DELETE' });
		}
		selectedPhotoIds = new Set();
		if (selectedAlbum) await loadAlbumPhotos(selectedAlbum.id);
	}

	// Tags management
	function openTagDialog() {
		if (selectedPhotoIds.size === 0) return;
		selectedTagIds = new Set();
		showTagDialog = true;
	}

	async function createTag() {
		if (!newTagName.trim()) return;
		const res = await fetch('/api/tags', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newTagName.trim() })
		});
		if (res.ok) {
			newTagName = '';
			await loadTags();
		}
	}

	async function applyTags() {
		if (selectedPhotoIds.size === 0) return;
		const tagIds = [...selectedTagIds];
		for (const photoId of selectedPhotoIds) {
			await fetch(`/api/photos/${photoId}/tags`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tagIds })
			});
		}
		showTagDialog = false;
		if (selectedAlbum) await loadAlbumPhotos(selectedAlbum.id);
	}

	function getPhotoUrl(photo: Photo, thumbnail = true): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}
</script>

<svelte:head>
	<title>相簿管理 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">相簿管理</h1>
		<Dialog.Root bind:open={showCreate}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props}>新增相簿</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>新增相簿</Dialog.Title>
					<Dialog.Description>建立一個新的相簿來整理您的圖片</Dialog.Description>
				</Dialog.Header>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						createAlbum();
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="album-name">相簿名稱</Label>
						<Input id="album-name" bind:value={newName} placeholder="輸入相簿名稱" required />
					</div>
					<div class="space-y-2">
						<Label for="album-desc">描述 (選填)</Label>
						<Input id="album-desc" bind:value={newDescription} placeholder="相簿描述" />
					</div>
					<div class="flex items-center gap-2">
						<input
							id="album-public"
							type="checkbox"
							bind:checked={newIsPublic}
							class="h-4 w-4 rounded border-input"
						/>
						<Label for="album-public">公開相簿</Label>
					</div>
					<Dialog.Footer>
						<Button type="submit" disabled={creating || !newName.trim()}>
							{creating ? '建立中...' : '建立'}
						</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	<div class="flex flex-col gap-6 md:flex-row">
		<div class="md:hidden">
			{#if albums.length > 0}
				<select
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					value={selectedAlbum?.id || ''}
					onchange={(e) => {
						const value = e.currentTarget.value;
						if (!value) return;
						const album = albums.find((a) => a.id === value);
						if (album) openAlbumDetail(album);
					}}
				>
					<option value="">選擇相簿</option>
					{#each albums as album}
						<option value={album.id}>
							{album.name}
							{#if album.isSystem}(系統){/if}
							{#if album.isPublic}[公開]{:else}[私人]{/if}
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<div class="hidden w-80 shrink-0 md:block">
			{#if loading}
				<div class="flex justify-center py-20">
					<div class="text-muted-foreground">載入中...</div>
				</div>
			{:else if albums.length === 0}
				<div class="py-20 text-center text-muted-foreground">
					<p>還沒有相簿</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each albums as album}
						<button
							class="w-full rounded-lg border p-3 text-left transition-colors {selectedAlbum?.id ===
							album.id
								? 'border-primary bg-primary/5'
								: 'border-border hover:border-foreground/20'}"
							onclick={() => openAlbumDetail(album)}
						>
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium">{album.name}</span>
								<div class="flex items-center gap-1">
									{#if album.isSystem}
										<span
											class="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-500"
										>
											系統
										</span>
									{/if}
									<span
										class="rounded-full px-1.5 py-0.5 text-[10px] {album.isPublic
											? 'bg-green-500/10 text-green-500'
											: 'bg-muted text-muted-foreground'}"
									>
										{album.isPublic ? '公開' : '私人'}
									</span>
								</div>
							</div>
							{#if album.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{album.description}
								</p>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Album Detail / Photo Management -->
		<div class="min-w-0 flex-1">
			{#if !selectedAlbum}
				<div class="flex h-64 items-center justify-center text-muted-foreground">
					選擇左側的相簿來管理照片
				</div>
			{:else}
				<!-- Album Header -->
				<div class="mb-4 flex items-center justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-lg font-semibold">{selectedAlbum.name}</h2>
							<a
								href="/album/{selectedAlbum.id}"
								class="text-xs text-muted-foreground hover:text-foreground"
							>
								查看 &rarr;
							</a>
						</div>
						<p class="text-sm text-muted-foreground">{albumPhotos.length} 張照片</p>
					</div>
					<div class="flex items-center gap-2">
						{#if !selectedAlbum.isSystem}
							<Button variant="outline" size="sm" onclick={() => togglePublic(selectedAlbum!)}>
								{selectedAlbum.isPublic ? '設為私人' : '設為公開'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="text-destructive hover:text-destructive"
								onclick={() => confirmDelete(selectedAlbum!)}
							>
								刪除相簿
							</Button>
						{/if}
					</div>
				</div>

				<!-- Batch Actions -->
				{#if selectedPhotoIds.size > 0}
					<div
						class="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2"
					>
						<span class="text-sm">已選取 {selectedPhotoIds.size} 張</span>
						<Button variant="outline" size="sm" onclick={batchRemoveFromAlbum}>從相簿移除</Button>
						<Button
							variant="outline"
							size="sm"
							class="text-destructive hover:text-destructive"
							onclick={batchDeletePhotos}
						>
							永久刪除
						</Button>
						<Button variant="outline" size="sm" onclick={openTagDialog}>管理標籤</Button>
						<Button variant="ghost" size="sm" onclick={() => (selectedPhotoIds = new Set())}>
							取消選取
						</Button>
					</div>
				{/if}

				<!-- Photos Grid -->
				{#if loadingPhotos}
					<div class="flex justify-center py-12">
						<div class="text-muted-foreground">載入中...</div>
					</div>
				{:else if albumPhotos.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
						<p>此相簿沒有照片</p>
					</div>
				{:else}
					<div class="mb-2 flex items-center justify-between">
						<Button variant="ghost" size="sm" onclick={selectAllPhotos}>
							{selectedPhotoIds.size === albumPhotos.length ? '取消全選' : '全選'}
						</Button>
					</div>
					<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
						{#each albumPhotos as photo}
							<button
								class="group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors {selectedPhotoIds.has(
									photo.id
								)
									? 'border-primary'
									: 'border-transparent'}"
								onclick={() => togglePhotoSelect(photo.id)}
							>
								<img
									src={getPhotoUrl(photo)}
									alt={photo.title || photo.originalFilename}
									class="h-full w-full object-cover"
									loading="lazy"
								/>
								<!-- Selection indicator -->
								<div
									class="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 {selectedPhotoIds.has(
										photo.id
									)
										? 'border-primary bg-primary'
										: 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'}"
								>
									{#if selectedPhotoIds.has(photo.id)}
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
								<!-- Cover badge -->
								{#if photo.id === selectedAlbum?.coverPhotoId}
									<div
										class="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
									>
										封面
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={showDelete}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>確認刪除</Dialog.Title>
			<Dialog.Description>
				確定要刪除相簿「{deleteTarget?.name}」嗎？相簿內的照片連結將被移除，但照片本身不會被刪除。
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showDelete = false)}>取消</Button>
			<Button variant="destructive" onclick={executeDelete} disabled={deleting}>
				{deleting ? '刪除中...' : '確認刪除'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Tag Management Dialog -->
<Dialog.Root bind:open={showTagDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>管理標籤</Dialog.Title>
			<Dialog.Description>
				為選取的 {selectedPhotoIds.size} 張照片設定標籤（會覆蓋現有標籤）
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="flex gap-2">
				<Input bind:value={newTagName} placeholder="新增標籤..." class="flex-1" />
				<Button variant="outline" onclick={createTag} disabled={!newTagName.trim()}>新增</Button>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each allTags as tag}
					<button
						class="rounded-full border px-3 py-1 text-sm transition-colors {selectedTagIds.has(
							tag.id
						)
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border text-muted-foreground hover:border-foreground/20'}"
						onclick={() => {
							const next = new Set(selectedTagIds);
							if (next.has(tag.id)) next.delete(tag.id);
							else next.add(tag.id);
							selectedTagIds = next;
						}}
					>
						{tag.name}
					</button>
				{/each}
				{#if allTags.length === 0}
					<p class="text-sm text-muted-foreground">尚無標籤，請先建立</p>
				{/if}
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showTagDialog = false)}>取消</Button>
			<Button onclick={applyTags}>套用標籤</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
