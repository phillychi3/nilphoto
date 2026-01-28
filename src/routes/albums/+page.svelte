<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Album {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		shareToken: string | null;
		createdAt: string;
	}

	let albums = $state<Album[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let newName = $state('');
	let newDescription = $state('');
	let newIsPublic = $state(false);
	let creating = $state(false);

	onMount(async () => {
		await loadAlbums();
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
		await fetch(`/api/albums/${album.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isPublic: !album.isPublic })
		});
		await loadAlbums();
	}

	async function deleteAlbum(album: Album) {
		if (!confirm(`確定要刪除相簿「${album.name}」？所有圖片將一併刪除。`)) return;

		await fetch(`/api/albums/${album.id}`, { method: 'DELETE' });
		await loadAlbums();
	}
</script>

<svelte:head>
	<title>相簿管理 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
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

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if albums.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<p class="text-muted-foreground">還沒有相簿</p>
			<p class="mt-1 text-sm text-muted-foreground">點擊上方「新增相簿」按鈕來建立</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each albums as album}
				<Card.Root>
					<div class="flex items-center justify-between p-4">
						<div class="min-w-0 flex-1">
							<a
								href="/album/{album.id}"
								class="text-sm font-medium hover:underline"
							>
								{album.name}
							</a>
							{#if album.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{album.description}
								</p>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<span
								class="rounded-full px-2 py-0.5 text-xs {album.isPublic
									? 'bg-green-500/10 text-green-500'
									: 'bg-muted text-muted-foreground'}"
							>
								{album.isPublic ? '公開' : '私人'}
							</span>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => togglePublic(album)}
							>
								{album.isPublic ? '設為私人' : '設為公開'}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								class="text-destructive hover:text-destructive"
								onclick={() => deleteAlbum(album)}
							>
								刪除
							</Button>
						</div>
					</div>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
