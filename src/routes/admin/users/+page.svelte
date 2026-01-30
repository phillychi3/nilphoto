<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

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

	let users = $state<User[]>([]);
	let codes = $state<InviteCode[]>([]);
	let loadingUsers = $state(true);
	let loadingCodes = $state(true);

	// Invite code creation
	let showCreateCode = $state(false);
	let codeMaxUses = $state(1);
	let codeExpiresDays = $state(7);
	let creatingCode = $state(false);

	onMount(async () => {
		await Promise.all([loadUsers(), loadCodes()]);
	});

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

	async function changeRole(userId: string, newRole: string) {
		await fetch('/api/users', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId, role: newRole })
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

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('zh-TW');
	}

	function isExpired(code: InviteCode): boolean {
		if (!code.expiresAt) return false;
		return new Date(code.expiresAt) < new Date();
	}
</script>

<svelte:head>
	<title>人員管理 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold">人員管理</h1>

	<!-- Users Section -->
	<div class="mb-8">
		<h2 class="mb-4 text-lg font-semibold">使用者列表</h2>
		{#if loadingUsers}
			<div class="py-8 text-center text-muted-foreground">載入中...</div>
		{:else if users.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					尚無使用者
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="space-y-2">
				{#each users as user}
					<Card.Root>
						<div class="flex items-center justify-between p-4">
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">{user.name || user.email}</span>
									{#if user.name}
										<span class="text-xs text-muted-foreground">{user.email}</span>
									{/if}
								</div>
								<p class="mt-0.5 text-xs text-muted-foreground">
									{formatDate(user.createdAt)}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<select
									class="rounded-md border border-input bg-background px-2 py-1 text-sm"
									value={user.role}
									onchange={(e) => changeRole(user.id, (e.target as HTMLSelectElement).value)}
								>
									<option value="admin">管理員</option>
									<option value="viewer">檢視者</option>
								</select>
							</div>
						</div>
					</Card.Root>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Invite Codes Section -->
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
				<Card.Content class="py-8 text-center text-muted-foreground">
					尚無邀請碼
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="space-y-2">
				{#each codes as code}
					<Card.Root>
						<div class="flex items-center justify-between p-4">
							<div>
								<div class="flex items-center gap-2">
									<code class="rounded bg-muted px-2 py-0.5 text-sm font-mono">
										{code.code}
									</code>
									{#if !code.isActive}
										<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
											已停用
										</span>
									{:else if isExpired(code)}
										<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
											已過期
										</span>
									{:else}
										<span class="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500">
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
