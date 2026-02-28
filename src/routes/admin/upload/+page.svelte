<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';

	interface Album {
		id: string;
		name: string;
	}

	interface UploadItem {
		file: File;
		preview: string;
		status: 'pending' | 'uploading' | 'done' | 'error';
		progress: number;
		error?: string;
	}

	let albums = $state<Album[]>([]);
	let selectedAlbumId = $state('');
	let newAlbumName = $state('');
	let uploadItems = $state<UploadItem[]>([]);
	let dragging = $state(false);
	let loading = $state(true);

	onMount(async () => {
		const res = await fetch('/api/albums?includePrivate=true');
		const data = await res.json();
		albums = data.albums;
		if (albums.length > 0) {
			selectedAlbumId = albums[0].id;
		}
		loading = false;
	});

	async function createAlbum() {
		if (!newAlbumName.trim()) return;

		const res = await fetch('/api/albums', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newAlbumName.trim(), isPublic: false })
		});

		if (res.ok) {
			const data = await res.json();
			albums = [data.album, ...albums];
			selectedAlbumId = data.album.id;
			newAlbumName = '';
		}
	}

	function addFiles(files: FileList | File[]) {
		const newItems: UploadItem[] = Array.from(files)
			.filter((f) => f.type.startsWith('image/'))
			.map((file) => ({
				file,
				preview: URL.createObjectURL(file),
				status: 'pending' as const,
				progress: 0
			}));
		uploadItems = [...uploadItems, ...newItems];
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer?.files) {
			addFiles(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function handleDragLeave() {
		dragging = false;
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			addFiles(input.files);
		}
	}

	function removeItem(index: number) {
		URL.revokeObjectURL(uploadItems[index].preview);
		uploadItems = uploadItems.filter((_, i) => i !== index);
	}

	async function uploadFile(index: number) {
		const item = uploadItems[index];
		uploadItems[index] = { ...item, status: 'uploading', progress: 0 };

		try {
			const formData = new FormData();
			formData.append('file', item.file);
			if (selectedAlbumId) {
				formData.append('albumId', selectedAlbumId);
			}

			const res = await fetch('/api/photos/upload', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const data = await res.json();
				uploadItems[index] = { ...uploadItems[index], status: 'error', error: data.error };
			} else {
				uploadItems[index] = { ...uploadItems[index], status: 'done', progress: 100 };
			}
		} catch {
			uploadItems[index] = { ...uploadItems[index], status: 'error', error: '上傳失敗' };
		}
	}

	async function uploadAll() {
		const CONCURRENCY = 3;
		const pendingIndices = uploadItems
			.map((item, index) => ({ item, index }))
			.filter(({ item }) => item.status === 'pending')
			.map(({ index }) => index);

		for (let i = 0; i < pendingIndices.length; i += CONCURRENCY) {
			const batch = pendingIndices.slice(i, i + CONCURRENCY);
			await Promise.all(batch.map((index) => uploadFile(index)));
		}
	}

	let pendingCount = $derived(uploadItems.filter((i) => i.status === 'pending').length);
	let doneCount = $derived(uploadItems.filter((i) => i.status === 'done').length);
</script>

<svelte:head>
	<title>上傳圖片 - {page.data.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold">上傳圖片</h1>

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else}
		<Card.Root class="mb-6">
			<Card.Header>
				<Card.Title>選擇相簿</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-4 sm:flex-row">
					<div class="flex-1">
						<select
							class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
							bind:value={selectedAlbumId}
						>
							<option value="">不歸入相簿</option>
							{#each albums as album}
								<option value={album.id}>{album.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex gap-2">
						<Input
							placeholder="新相簿名稱"
							bind:value={newAlbumName}
							class="flex-1 sm:w-40 sm:flex-initial"
						/>
						<Button variant="outline" onclick={createAlbum} disabled={!newAlbumName.trim()}>
							建立
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<div
			class="mb-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors {dragging
				? 'border-primary bg-primary/5'
				: 'border-border hover:border-foreground/20'}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			role="button"
			tabindex="0"
			onclick={() => document.getElementById('file-input')?.click()}
			onkeydown={(e) => {
				if (e.key === 'Enter') document.getElementById('file-input')?.click();
			}}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mb-4 text-muted-foreground"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" x2="12" y1="3" y2="15" />
			</svg>
			<p class="text-muted-foreground">拖放圖片到此處，或點擊選擇檔案</p>
			<p class="mt-1 text-xs text-muted-foreground">
				支援 JPEG, PNG, WebP, AVIF, HEIC, TIFF (最大 50MB)
			</p>
			<input
				id="file-input"
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				onchange={handleFileInput}
			/>
		</div>

		{#if uploadItems.length > 0}
			<div class="mb-4 flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{uploadItems.length} 個檔案 &middot; {doneCount} 已上傳
				</p>
				<Button onclick={uploadAll} disabled={pendingCount === 0}>
					上傳全部 ({pendingCount})
				</Button>
			</div>

			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
				{#each uploadItems as item, index}
					<div class="group relative overflow-hidden rounded-lg border border-border">
						<img
							src={item.preview}
							alt={item.file.name}
							class="aspect-square w-full object-cover"
						/>

						{#if item.status === 'uploading'}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<div
									class="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
								></div>
							</div>
						{:else if item.status === 'done'}
							<div class="absolute inset-0 flex items-center justify-center bg-black/30">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="32"
									height="32"
									viewBox="0 0 24 24"
									fill="none"
									stroke="white"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							</div>
						{:else if item.status === 'error'}
							<div class="absolute inset-0 flex items-center justify-center bg-destructive/30">
								<p class="text-xs text-white">{item.error}</p>
							</div>
						{/if}

						{#if item.status === 'pending'}
							<button
								class="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
								onclick={() => removeItem(index)}
								aria-label="移除"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M18 6 6 18" /><path d="m6 6 12 12" />
								</svg>
							</button>
						{/if}

						<div class="px-2 py-1">
							<p class="truncate text-xs text-muted-foreground">{item.file.name}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
