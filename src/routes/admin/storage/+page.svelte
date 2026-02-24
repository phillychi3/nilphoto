<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

	interface StorageConfig {
		id: string;
		provider: string;
		name: string;
		isDefault: boolean;
		config: Record<string, string>;
		createdAt: string;
	}

	interface SyncResult {
		total: number;
		alreadySynced: number;
		added: number;
		errors: number;
		errorDetails: string[];
	}

	let configs = $state<StorageConfig[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let testing = $state<string | null>(null);
	let testResult = $state<{ success: boolean; message: string } | null>(null);
	let syncing = $state<string | null>(null);
	let syncResult = $state<{ configId: string; result: SyncResult } | null>(null);

	// Form state
	let formProvider = $state<'s3' | 'r2'>('s3');
	let formName = $state('');
	let formIsDefault = $state(false);
	let formBucket = $state('');
	let formRegion = $state('');
	let formEndpoint = $state('');
	let formAccessKeyId = $state('');
	let formSecretAccessKey = $state('');
	let formPublicUrl = $state('');
	let saving = $state(false);

	onMount(async () => {
		await loadConfigs();
	});

	async function loadConfigs() {
		loading = true;
		try {
			const res = await fetch('/api/storage-configs');
			const data = await res.json();
			configs = data.configs;
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		formProvider = 's3';
		formName = '';
		formIsDefault = false;
		formBucket = '';
		formRegion = '';
		formEndpoint = '';
		formAccessKeyId = '';
		formSecretAccessKey = '';
		formPublicUrl = '';
	}

	async function createConfig() {
		if (!formName.trim() || !formBucket.trim()) return;
		saving = true;

		try {
			const res = await fetch('/api/storage-configs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: formProvider,
					name: formName.trim(),
					isDefault: formIsDefault,
					config: {
						bucket: formBucket.trim(),
						region: formRegion.trim() || undefined,
						endpoint: formEndpoint.trim() || undefined,
						accessKeyId: formAccessKeyId.trim(),
						secretAccessKey: formSecretAccessKey.trim(),
						publicUrl: formPublicUrl.trim() || undefined
					}
				})
			});

			if (res.ok) {
				showCreate = false;
				resetForm();
				await loadConfigs();
			}
		} finally {
			saving = false;
		}
	}

	async function setDefault(id: string) {
		await fetch(`/api/storage-configs/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isDefault: true })
		});
		await loadConfigs();
	}

	async function deleteConfig(config: StorageConfig) {
		if (!confirm(`確定要刪除「${config.name}」？`)) return;
		await fetch(`/api/storage-configs/${config.id}`, { method: 'DELETE' });
		await loadConfigs();
	}

	async function testConnection(configId: string) {
		testing = configId;
		testResult = null;

		try {
			const res = await fetch('/api/storage-configs/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ configId })
			});
			const data = await res.json();
			testResult = {
				success: res.ok,
				message: data.message || data.error || '未知結果'
			};
		} catch {
			testResult = { success: false, message: '測試失敗' };
		} finally {
			testing = null;
		}
	}

	async function syncStorage(configId: string) {
		syncing = configId;
		syncResult = null;

		try {
			const res = await fetch('/api/photos/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ storageConfigId: configId })
			});
			const data = await res.json();
			if (res.ok) {
				syncResult = { configId, result: data.results };
			} else {
				syncResult = {
					configId,
					result: {
						total: 0,
						alreadySynced: 0,
						added: 0,
						errors: 1,
						errorDetails: [data.error || '同步失敗']
					}
				};
			}
		} catch {
			syncResult = {
				configId,
				result: {
					total: 0,
					alreadySynced: 0,
					added: 0,
					errors: 1,
					errorDetails: ['連線失敗']
				}
			};
		} finally {
			syncing = null;
		}
	}

	function providerLabel(provider: string): string {
		switch (provider) {
			case 's3':
				return 'AWS S3';
			case 'r2':
				return 'Cloudflare R2';
			case 'github':
				return 'GitHub';
			default:
				return provider;
		}
	}
</script>

<svelte:head>
	<title>儲存設定 - {page.data.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-4xl py-4">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">儲存服務設定</h1>
			<p class="mt-1 text-sm text-muted-foreground">管理圖片儲存位置。未設定時預設使用本地儲存。</p>
		</div>
		<Dialog.Root bind:open={showCreate}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props}>新增儲存設定</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content class="max-w-lg">
				<Dialog.Header>
					<Dialog.Title>新增儲存設定</Dialog.Title>
					<Dialog.Description>設定 S3 或 R2 儲存服務</Dialog.Description>
				</Dialog.Header>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						createConfig();
					}}
					class="space-y-4"
				>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="provider">儲存提供者</Label>
							<select
								id="provider"
								class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
								bind:value={formProvider}
							>
								<option value="s3">AWS S3</option>
								<option value="r2">Cloudflare R2</option>
							</select>
						</div>
						<div class="space-y-2">
							<Label for="config-name">名稱</Label>
							<Input id="config-name" bind:value={formName} placeholder="例如: 主要儲存" required />
						</div>
					</div>

					<div class="space-y-2">
						<Label for="bucket">Bucket</Label>
						<Input id="bucket" bind:value={formBucket} placeholder="my-bucket" required />
					</div>

					{#if formProvider === 's3'}
						<div class="space-y-2">
							<Label for="region">Region</Label>
							<Input id="region" bind:value={formRegion} placeholder="ap-northeast-1" />
						</div>
					{/if}

					{#if formProvider === 'r2'}
						<div class="space-y-2">
							<Label for="endpoint">Endpoint</Label>
							<Input
								id="endpoint"
								bind:value={formEndpoint}
								placeholder="https://<account-id>.r2.cloudflarestorage.com"
								required
							/>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="access-key">Access Key ID</Label>
							<Input id="access-key" bind:value={formAccessKeyId} required />
						</div>
						<div class="space-y-2">
							<Label for="secret-key">Secret Access Key</Label>
							<Input id="secret-key" type="password" bind:value={formSecretAccessKey} required />
						</div>
					</div>

					<div class="space-y-2">
						<Label for="public-url">Public URL (選填)</Label>
						<Input
							id="public-url"
							bind:value={formPublicUrl}
							placeholder="https://cdn.example.com"
						/>
						<p class="text-xs text-muted-foreground">CDN 或自訂網域 URL，用於生成公開連結</p>
					</div>

					<div class="flex items-center gap-2">
						<input
							id="is-default"
							type="checkbox"
							bind:checked={formIsDefault}
							class="h-4 w-4 rounded border-input"
						/>
						<Label for="is-default">設為預設儲存</Label>
					</div>

					<Dialog.Footer>
						<Button type="submit" disabled={saving || !formName.trim() || !formBucket.trim()}>
							{saving ? '建立中...' : '建立'}
						</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	<Card.Root class="mb-6">
		<Card.Content class="p-4">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"
						/>
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium">
						目前使用：{configs.find((c) => c.isDefault)?.name || '本地儲存 (static/uploads)'}
					</p>
					<p class="text-xs text-muted-foreground">
						{configs.find((c) => c.isDefault)
							? providerLabel(configs.find((c) => c.isDefault)!.provider)
							: '檔案儲存在伺服器本地目錄'}
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if configs.length === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center justify-center py-12">
				<p class="text-muted-foreground">尚未設定雲端儲存服務</p>
				<p class="mt-1 text-sm text-muted-foreground">
					目前圖片會儲存在伺服器本地 static/uploads 目錄
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-3">
			{#each configs as config}
				<Card.Root>
					<div class="flex items-center justify-between p-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium">{config.name}</span>
								<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{providerLabel(config.provider)}
								</span>
								{#if config.isDefault}
									<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
										預設
									</span>
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-muted-foreground">
								Bucket: {config.config.bucket}
								{#if config.config.region}
									&middot; Region: {config.config.region}
								{/if}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if testResult && testing === null}
								<span class="text-xs {testResult.success ? 'text-green-500' : 'text-destructive'}">
									{testResult.message}
								</span>
							{/if}
							<Button
								variant="outline"
								size="sm"
								onclick={() => testConnection(config.id)}
								disabled={testing !== null || syncing !== null}
							>
								{testing === config.id ? '測試中...' : '測試連線'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => syncStorage(config.id)}
								disabled={syncing !== null || testing !== null}
							>
								{syncing === config.id ? '同步中...' : '同步到資料庫'}
							</Button>
							{#if !config.isDefault}
								<Button variant="ghost" size="sm" onclick={() => setDefault(config.id)}>
									設為預設
								</Button>
							{/if}
							<Button
								variant="ghost"
								size="sm"
								class="text-destructive hover:text-destructive"
								onclick={() => deleteConfig(config)}
							>
								刪除
							</Button>
						</div>
					</div>
					{#if syncResult && syncResult.configId === config.id}
						<div class="border-t px-4 py-3 text-sm">
							{#if syncResult.result.errors > 0 && syncResult.result.added === 0 && syncResult.result.total === 0}
								<p class="text-destructive">{syncResult.result.errorDetails[0]}</p>
							{:else}
								<div class="flex flex-wrap gap-4 text-muted-foreground">
									<span
										>找到 <strong class="text-foreground">{syncResult.result.total}</strong> 張圖片</span
									>
									<span
										>已同步 <strong class="text-foreground"
											>{syncResult.result.alreadySynced}</strong
										> 張</span
									>
									<span class="text-green-600"
										>新增 <strong>{syncResult.result.added}</strong> 張</span
									>
									{#if syncResult.result.errors > 0}
										<span class="text-destructive"
											>失敗 <strong>{syncResult.result.errors}</strong> 張</span
										>
									{/if}
								</div>
								{#if syncResult.result.errorDetails.length > 0}
									<details class="mt-2">
										<summary class="cursor-pointer text-xs text-destructive">查看錯誤詳情</summary>
										<ul class="mt-1 space-y-0.5 text-xs text-destructive">
											{#each syncResult.result.errorDetails as detail}
												<li>{detail}</li>
											{/each}
										</ul>
									</details>
								{/if}
							{/if}
						</div>
					{/if}
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
