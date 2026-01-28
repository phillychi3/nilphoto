<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let name = $state('');
	let inviteCode = $state('');
	let error = $state('');
	let loading = $state(false);
	let registrationMode = $state<'open' | 'invite_only' | 'closed'>('open');
	let checkingMode = $state(true);

	onMount(async () => {
		// Get invite code from URL if present
		const urlCode = $page.url.searchParams.get('code');
		if (urlCode) {
			inviteCode = urlCode;
		}

		// Check registration mode
		try {
			const res = await fetch('/api/auth/registration-mode');
			const data = await res.json();
			registrationMode = data.mode;
		} catch {
			// Default to open if can't fetch
		} finally {
			checkingMode = false;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password !== confirmPassword) {
			error = '密碼不一致';
			return;
		}

		if (password.length < 8) {
			error = '密碼長度至少需要 8 個字元';
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					password,
					name: name || undefined,
					inviteCode: inviteCode || undefined
				})
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || '註冊失敗';
				return;
			}

			goto('/');
		} catch (err) {
			error = '發生錯誤，請稍後再試';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>註冊 - NILPhoto</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">NILPhoto</Card.Title>
			<Card.Description>建立您的帳戶</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if checkingMode}
				<div class="flex justify-center py-8">
					<div class="text-muted-foreground">載入中...</div>
				</div>
			{:else if registrationMode === 'closed'}
				<div class="py-8 text-center">
					<p class="text-muted-foreground">目前不開放註冊</p>
					<p class="mt-2 text-sm text-muted-foreground">請聯繫管理員取得帳戶</p>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="name">名稱 (選填)</Label>
						<Input
							id="name"
							type="text"
							placeholder="您的名稱"
							bind:value={name}
							disabled={loading}
						/>
					</div>

					<div class="space-y-2">
						<Label for="email">電子郵件</Label>
						<Input
							id="email"
							type="email"
							placeholder="your@email.com"
							bind:value={email}
							required
							disabled={loading}
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">密碼</Label>
						<Input
							id="password"
							type="password"
							placeholder="••••••••"
							bind:value={password}
							required
							disabled={loading}
						/>
						<p class="text-xs text-muted-foreground">至少 8 個字元</p>
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">確認密碼</Label>
						<Input
							id="confirmPassword"
							type="password"
							placeholder="••••••••"
							bind:value={confirmPassword}
							required
							disabled={loading}
						/>
					</div>

					{#if registrationMode === 'invite_only'}
						<div class="space-y-2">
							<Label for="inviteCode">邀請碼</Label>
							<Input
								id="inviteCode"
								type="text"
								placeholder="輸入邀請碼"
								bind:value={inviteCode}
								required
								disabled={loading}
							/>
						</div>
					{/if}

					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? '註冊中...' : '註冊'}
					</Button>
				</form>
			{/if}
		</Card.Content>
		<Card.Footer class="flex justify-center">
			<p class="text-sm text-muted-foreground">
				已有帳戶？
				<a href="/login" class="text-primary hover:underline">登入</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
