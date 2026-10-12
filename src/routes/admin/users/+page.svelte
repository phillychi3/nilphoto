<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Table from '#lib/components/ui/table/index.js';

	interface User {
		id: string;
		email: string;
		name: string | null;
		role: string;
		createdAt: string;
	}

	interface InviteCode {
		id: string;
		code: string;
		maxUses: number;
		usedCount: number;
		expiresAt: string | null;
		isActive: boolean;
		createdAt: string;
		creator: { id: string; name: string | null; email: string };
	}

	type SortColumn = 'name' | 'role' | 'createdAt';
	type SortDir = 'asc' | 'desc';
	type RegistrationMode = 'open' | 'invite_only' | 'closed';

	let users = $state<User[]>([]);
	let codes = $state<InviteCode[]>([]);
	let loadingUsers = $state(true);
	let loadingCodes = $state(true);

	// Registration mode
	let registrationMode = $state<RegistrationMode>('open');
	let loadingMode = $state(true);
	let savingMode = $state(false);

	// User table
	let searchQuery = $state('');
	let sortColumn = $state<SortColumn>('createdAt');
	let sortDir = $state<SortDir>('desc');

	// Create user dialog
	let showCreateUser = $state(false);
	let newEmail = $state('');
	let newPassword = $state('');
	let newName = $state('');
	let newRole = $state<'admin' | 'viewer'>('viewer');
	let createError = $state('');
	let creatingUser = $state(false);

	// Current user id (to prevent self-delete)
	let currentUserId = $derived(page.data.user?.id as string | undefined);

	// Invite code creation
	let showCreateCode = $state(false);
	let codeMaxUses = $state(1);
	let codeExpiresDays = $state(7);
	let creatingCode = $state(false);

	let filteredUsers = $derived.by(() => {
		let result = users;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(u) => u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false)
			);
		}
		return [...result].sort((a, b) => {
			let aVal: string, bVal: string;
			if (sortColumn === 'name') {
				aVal = (a.name || a.email).toLowerCase();
				bVal = (b.name || b.email).toLowerCase();
			} else if (sortColumn === 'role') {
				aVal = a.role;
				bVal = b.role;
			} else {
				aVal = a.createdAt;
				bVal = b.createdAt;
			}
			return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		});
	});

	onMount(async () => {
		await Promise.all([loadUsers(), loadCodes(), loadRegistrationMode()]);
	});

	async function loadRegistrationMode() {
		loadingMode = true;
		try {
			const res = await fetch('/api/auth/registration-mode');
			const data = await res.json();
			registrationMode = data.mode;
		} finally {
			loadingMode = false;
		}
	}

	async function saveRegistrationMode(mode: string) {
		savingMode = true;
		try {
			await fetch('/api/auth/registration-mode', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			registrationMode = mode as RegistrationMode;
		} finally {
			savingMode = false;
		}
	}

	async function loadUsers() {
		loadingUsers = true;
		try {
			const res = await fetch('/api/users');
			const data = await res.json();
			users = data.users || [];
		} finally {
			loadingUsers = false;
		}
	}

	async function loadCodes() {
		loadingCodes = true;
		try {
			const res = await fetch('/api/invite-codes');
			const data = await res.json();
			codes = data.codes || [];
		} finally {
			loadingCodes = false;
		}
	}

	async function changeRole(userId: string, role: string) {
		await fetch('/api/users', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, role })
		});
		await loadUsers();
	}

	async function createUser() {
		createError = '';
		creatingUser = true;
		try {
			const res = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: newEmail,
					password: newPassword,
					name: newName || undefined,
					role: newRole
				})
			});
			const data = await res.json();
			if (!res.ok) {
				createError = data.error || '建立失敗';
				return;
			}
			showCreateUser = false;
			newEmail = '';
			newPassword = '';
			newName = '';
			newRole = 'viewer';
			await loadUsers();
		} finally {
			creatingUser = false;
		}
	}

	async function deleteUser(userId: string) {
		await fetch('/api/users', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId })
		});
		await loadUsers();
	}

	async function createInviteCode() {
		creatingCode = true;
		try {
			const res = await fetch('/api/invite-codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ maxUses: codeMaxUses, expiresInDays: codeExpiresDays })
			});
			if (res.ok) {
				showCreateCode = false;
				codeMaxUses = 1;
				codeExpiresDays = 7;
				await loadCodes();
			}
		} finally {
			creatingCode = false;
		}
	}

	async function deactivateCode(codeId: string) {
		await fetch('/api/invite-codes', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ codeId })
		});
		await loadCodes();
	}

	function toggleSort(col: SortColumn) {
		if (sortColumn === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = col;
			sortDir = 'asc';
		}
	}

	function sortIndicator(col: SortColumn) {
		if (sortColumn !== col) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('zh-TW');
	}

	function isExpired(code: InviteCode): boolean {
		if (!code.expiresAt) return false;
		return new Date(code.expiresAt) < new Date();
	}
</script>

<svelte:head>
	<title>人員管理 - {page.data.siteName}</title>
</svelte:head>

<div class="mx-auto max-w-4xl py-4">
	<h1 class="mb-6 text-2xl font-bold">人員管理</h1>

	<Card.Root class="mb-8">
		<Card.Header class="pb-3">
			<Card.Title class="text-base">註冊模式</Card.Title>
			<Card.Description>控制新使用者如何加入系統</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center gap-1">
				<select
					class="rounded-md border border-input bg-background px-3 py-2 text-sm"
					value={registrationMode}
					disabled={loadingMode || savingMode}
					onchange={(e) => saveRegistrationMode((e.target as HTMLSelectElement).value)}
				>
					<option value="open">開放註冊</option>
					<option value="invite_only">僅限邀請碼</option>
					<option value="closed">關閉註冊</option>
				</select>
				{#if savingMode}
					<span class="text-sm text-muted-foreground">儲存中...</span>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<div class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">使用者列表</h2>
			<Dialog.Root bind:open={showCreateUser}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<Button {...props} size="sm">新增人員</Button>
					{/snippet}
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>新增人員</Dialog.Title>
						<Dialog.Description>手動建立新的使用者帳號</Dialog.Description>
					</Dialog.Header>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							createUser();
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label for="new-email">電子郵件</Label>
							<Input id="new-email" type="email" bind:value={newEmail} required />
						</div>
						<div class="space-y-2">
							<Label for="new-password">密碼（至少 8 個字元）</Label>
							<Input
								id="new-password"
								type="password"
								bind:value={newPassword}
								required
								minlength={8}
							/>
						</div>
						<div class="space-y-2">
							<Label for="new-name">姓名（選填）</Label>
							<Input id="new-name" type="text" bind:value={newName} />
						</div>
						<div class="space-y-2">
							<Label for="new-role">角色</Label>
							<select
								id="new-role"
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								bind:value={newRole}
							>
								<option value="viewer">檢視者</option>
								<option value="admin">管理員</option>
							</select>
						</div>
						{#if createError}
							<p class="text-sm text-destructive">{createError}</p>
						{/if}
						<Dialog.Footer>
							<Button type="submit" disabled={creatingUser}>
								{creatingUser ? '建立中...' : '建立'}
							</Button>
						</Dialog.Footer>
					</form>
				</Dialog.Content>
			</Dialog.Root>
		</div>

		<div class="mb-3">
			<Input
				type="search"
				placeholder="搜尋姓名或電子郵件..."
				bind:value={searchQuery}
				class="max-w-sm"
			/>
		</div>

		{#if loadingUsers}
			<div class="py-8 text-center text-muted-foreground">載入中...</div>
		{:else if users.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">尚無使用者</Card.Content>
			</Card.Root>
		{:else}
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>
								<button
									class="flex items-center gap-1 font-medium hover:text-foreground"
									onclick={() => toggleSort('name')}
								>
									姓名 / 電子郵件{sortIndicator('name')}
								</button>
							</Table.Head>
							<Table.Head>
								<button
									class="flex items-center gap-1 font-medium hover:text-foreground"
									onclick={() => toggleSort('role')}
								>
									角色{sortIndicator('role')}
								</button>
							</Table.Head>
							<Table.Head>
								<button
									class="flex items-center gap-1 font-medium hover:text-foreground"
									onclick={() => toggleSort('createdAt')}
								>
									建立時間{sortIndicator('createdAt')}
								</button>
							</Table.Head>
							<Table.Head class="text-right">操作</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if filteredUsers.length === 0}
							<Table.Row>
								<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground">
									沒有符合的結果
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredUsers as user}
								<Table.Row>
									<Table.Cell>
										<div class="font-medium">{user.name || user.email}</div>
										{#if user.name}
											<div class="text-xs text-muted-foreground">{user.email}</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-sm">
										{user.role === 'admin' ? '管理員' : '檢視者'}
									</Table.Cell>
									<Table.Cell class="text-sm text-muted-foreground">
										{formatDate(user.createdAt)}
									</Table.Cell>
									<Table.Cell class="text-right">
										<div class="flex items-center justify-end gap-2">
											<select
												class="rounded-md border border-input bg-background px-2 py-1 text-sm"
												value={user.role}
												onchange={(e) => changeRole(user.id, (e.target as HTMLSelectElement).value)}
											>
												<option value="admin">管理員</option>
												<option value="viewer">檢視者</option>
											</select>
											{#if user.id !== currentUserId}
												<Button
													variant="ghost"
													size="sm"
													class="text-destructive hover:text-destructive"
													onclick={() => {
														if (
															confirm(
																`確定要刪除「${user.name || user.email}」的帳號？此操作無法復原。`
															)
														) {
															deleteUser(user.id);
														}
													}}
												>
													刪除
												</Button>
											{/if}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
			<p class="mt-2 text-sm text-muted-foreground">
				{#if searchQuery}
					顯示 {filteredUsers.length} / {users.length} 位
				{:else}
					共 {users.length} 位
				{/if}
			</p>
		{/if}
	</div>

	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">邀請碼</h2>
			<Dialog.Root bind:open={showCreateCode}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<Button {...props} size="sm">建立邀請碼</Button>
					{/snippet}
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>建立邀請碼</Dialog.Title>
						<Dialog.Description>建立新的邀請碼供使用者註冊</Dialog.Description>
					</Dialog.Header>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							createInviteCode();
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label for="max-uses">最大使用次數</Label>
							<Input id="max-uses" type="number" min="1" bind:value={codeMaxUses} />
						</div>
						<div class="space-y-2">
							<Label for="expires-days">有效天數</Label>
							<Input id="expires-days" type="number" min="1" bind:value={codeExpiresDays} />
						</div>
						<Dialog.Footer>
							<Button type="submit" disabled={creatingCode}>
								{creatingCode ? '建立中...' : '建立'}
							</Button>
						</Dialog.Footer>
					</form>
				</Dialog.Content>
			</Dialog.Root>
		</div>

		{#if loadingCodes}
			<div class="py-8 text-center text-muted-foreground">載入中...</div>
		{:else if codes.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">尚無邀請碼</Card.Content>
			</Card.Root>
		{:else}
			<div class="space-y-2">
				{#each codes as code}
					<Card.Root>
						<div class="flex items-center justify-between p-4">
							<div>
								<div class="flex items-center gap-2">
									<code class="rounded bg-muted px-2 py-0.5 font-mono text-sm">
										{code.code}
									</code>
									{#if !code.isActive}
										<span
											class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
										>
											已停用
										</span>
									{:else if isExpired(code)}
										<span
											class="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
										>
											已過期
										</span>
									{:else}
										<span
											class="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500"
										>
											有效
										</span>
									{/if}
								</div>
								<p class="mt-1 text-xs text-muted-foreground">
									已使用 {code.usedCount}/{code.maxUses} 次
									{#if code.expiresAt}
										&middot; 到期 {formatDate(code.expiresAt)}
									{/if}
									&middot; 由 {code.creator.name || code.creator.email} 建立
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onclick={() => navigator.clipboard.writeText(code.code)}
								>
									複製
								</Button>
								{#if code.isActive}
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:text-destructive"
										onclick={() => deactivateCode(code.id)}
									>
										停用
									</Button>
								{/if}
							</div>
						</div>
					</Card.Root>
				{/each}
			</div>
		{/if}
	</div>
</div>
