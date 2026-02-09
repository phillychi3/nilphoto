<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

	// ===== Site Settings =====
	let siteName = $state('');
	let siteDescription = $state('');
	let savingSite = $state(false);
	let siteMessage = $state('');

	// ===== Storage Configs =====
	interface StorageConfig {
		id: string;
		provider: string;
		name: string;
		isDefault: boolean;
		config: Record<string, string>;
		createdAt: string;
	}

	let configs = $state<StorageConfig[]>([]);
	let loadingStorage = $state(true);
	let showCreate = $state(false);
	let testing = $state<string | null>(null);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

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

	// Edit state
	let showEdit = $state(false);
	let editId = $state('');
	let editProvider = $state<'s3' | 'r2'>('s3');
	let editName = $state('');
	let editIsDefault = $state(false);
	let editBucket = $state('');
	let editRegion = $state('');
	let editEndpoint = $state('');
	let editAccessKeyId = $state('');
	let editSecretAccessKey = $state('');
	let editPublicUrl = $state('');

	onMount(async () => {
		await Promise.all([loadSiteSettings(), loadConfigs()]);
	});

	// ===== Site Settings Functions =====
	async function loadSiteSettings() {
		try {
			const res = await fetch('/api/site-settings');
			const data = await res.json();
			siteName = (data.settings?.site_name as string) || '';
			siteDescription = (data.settings?.site_description as string) || '';
		} catch {
			// ignore
		}
	}

	async function saveSiteSettings() {
		savingSite = true;
		siteMessage = '';
		try {
			const res = await fetch('/api/site-settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					settings: {
						site_name: siteName.trim(),
						site_description: siteDescription.trim()
					}
				})
			});
			if (res.ok) {
				siteMessage = '已儲存';
				setTimeout(() => (siteMessage = ''), 2000);
			}
		} finally {
			savingSite = false;
		}
	}

	// ===== Storage Functions =====
	async function loadConfigs() {
		loadingStorage = true;
		try {
			const res = await fetch('/api/storage-configs');
			const data = await res.json();
			configs = data.configs;
		} finally {
			loadingStorage = false;
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

	function openEdit(config: StorageConfig) {
		editId = config.id;
		editProvider = config.provider as 's3' | 'r2';
		editName = config.name;
		editIsDefault = config.isDefault;
		editBucket = config.config.bucket || '';
		editRegion = config.config.region || '';
		editEndpoint = config.config.endpoint || '';
		editAccessKeyId = config.config.accessKeyId || '';
		editSecretAccessKey = '';
		editPublicUrl = config.config.publicUrl || '';
		showEdit = true;
	}

	async function updateConfig() {
		if (!editName.trim() || !editBucket.trim()) return;
		saving = true;
		try {
			const res = await fetch(`/api/storage-configs/${editId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: editProvider,
					name: editName.trim(),
					isDefault: editIsDefault,
					config: {
						bucket: editBucket.trim(),
						region: editRegion.trim() || undefined,
						endpoint: editEndpoint.trim() || undefined,
						accessKeyId: editAccessKeyId.trim() || undefined,
						secretAccessKey: editSecretAccessKey.trim() || undefined,
						publicUrl: editPublicUrl.trim() || undefined
					}
				})
			});
			if (res.ok) {
				showEdit = false;
				await loadConfigs();
			}
		} finally {
			saving = false;
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
	<title>站點設定 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold">站點設定</h1>

	<!-- Site Basic Settings -->
	<Card.Root class="mb-8">
		<Card.Header>
			<Card.Title>基本設定</Card.Title>
			<Card.Description>站點名稱與描述</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveSiteSettings();
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="site-name">站點名稱</Label>
					<Input id="site-name" bind:value={siteName} placeholder="NILPhoto" />
				</div>
				<div class="space-y-2">
					<Label for="site-desc">站點描述</Label>
					<Input id="site-desc" bind:value={siteDescription} placeholder="Photo Gallery" />
				</div>
				<div class="flex items-center gap-3">
					<Button type="submit" disabled={savingSite}>
						{savingSite ? '儲存中...' : '儲存'}
					</Button>
					{#if siteMessage}
						<span class="text-sm text-green-500">{siteMessage}</span>
					{/if}
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Storage Settings -->
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold">儲存服務設定</h2>
			<p class="text-sm text-muted-foreground">管理圖片儲存位置。未設定時預設使用本地儲存。</p>
		</div>
		<Dialog.Root bind:open={showCreate}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button {...props} size="sm">新增儲存設定</Button>
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

	<!-- Current default info -->
	<Card.Root class="mb-4">
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
						目前使用：{configs.find((c) => c.isDefault)?.name || '本地儲存 (data/uploads)'}
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

	{#if loadingStorage}
		<div class="flex justify-center py-12">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if configs.length === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center justify-center py-12">
				<p class="text-muted-foreground">尚未設定雲端儲存服務</p>
				<p class="mt-1 text-sm text-muted-foreground">
					目前圖片會儲存在伺服器本地 data/uploads 目錄
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
							<Button variant="outline" size="sm" onclick={() => openEdit(config)}>編輯</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => testConnection(config.id)}
								disabled={testing !== null}
							>
								{testing === config.id ? '測試中...' : '測試連線'}
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
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Edit Storage Dialog -->
<Dialog.Root bind:open={showEdit}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>編輯儲存設定</Dialog.Title>
			<Dialog.Description>修改儲存服務設定</Dialog.Description>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				updateConfig();
			}}
			class="space-y-4"
		>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-provider">儲存提供者</Label>
					<select
						id="edit-provider"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						bind:value={editProvider}
					>
						<option value="s3">AWS S3</option>
						<option value="r2">Cloudflare R2</option>
					</select>
				</div>
				<div class="space-y-2">
					<Label for="edit-name">名稱</Label>
					<Input id="edit-name" bind:value={editName} placeholder="例如: 主要儲存" required />
				</div>
			</div>

			<div class="space-y-2">
				<Label for="edit-bucket">Bucket</Label>
				<Input id="edit-bucket" bind:value={editBucket} placeholder="my-bucket" required />
			</div>

			{#if editProvider === 's3'}
				<div class="space-y-2">
					<Label for="edit-region">Region</Label>
					<Input id="edit-region" bind:value={editRegion} placeholder="ap-northeast-1" />
				</div>
			{/if}

			{#if editProvider === 'r2'}
				<div class="space-y-2">
					<Label for="edit-endpoint">Endpoint</Label>
					<Input
						id="edit-endpoint"
						bind:value={editEndpoint}
						placeholder="https://<account-id>.r2.cloudflarestorage.com"
						required
					/>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="edit-access-key">Access Key ID</Label>
					<Input id="edit-access-key" bind:value={editAccessKeyId} placeholder="留空則不變更" />
				</div>
				<div class="space-y-2">
					<Label for="edit-secret-key">Secret Access Key</Label>
					<Input
						id="edit-secret-key"
						type="password"
						bind:value={editSecretAccessKey}
						placeholder="留空則不變更"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="edit-public-url">Public URL (選填)</Label>
				<Input
					id="edit-public-url"
					bind:value={editPublicUrl}
					placeholder="https://cdn.example.com"
				/>
				<p class="text-xs text-muted-foreground">CDN 或自訂網域 URL，用於生成公開連結</p>
			</div>

			<div class="flex items-center gap-2">
				<input
					id="edit-is-default"
					type="checkbox"
					bind:checked={editIsDefault}
					class="h-4 w-4 rounded border-input"
				/>
				<Label for="edit-is-default">設為預設儲存</Label>
			</div>

			<Dialog.Footer>
				<Button variant="outline" onclick={() => (showEdit = false)}>取消</Button>
				<Button type="submit" disabled={saving || !editName.trim() || !editBucket.trim()}>
					{saving ? '儲存中...' : '儲存'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
