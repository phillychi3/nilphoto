<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	let showChangeCredentials = $state(false);
	let redirectAfterChange = $state('/');
	let newEmail = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changeError = $state('');
	let changing = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || '登入失敗';
				return;
			}

			const redirectTo = page.url.searchParams.get('redirect') || '/';

			if (data.mustChangePassword) {
				newEmail = email;
				redirectAfterChange = redirectTo;
				showChangeCredentials = true;
			} else {
				goto(redirectTo);
			}
		} catch (err) {
			error = '發生錯誤，請稍後再試';
		} finally {
			loading = false;
		}
	}

	async function handleChangeCredentials(e: Event) {
		e.preventDefault();
		changeError = '';

		if (newPassword !== confirmPassword) {
			changeError = '兩次輸入的密碼不一致';
			return;
		}

		if (newPassword.length < 8) {
			changeError = '密碼長度至少需要 8 個字元';
			return;
		}

		changing = true;
		try {
			const res = await fetch('/api/auth/change-credentials', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newEmail, newPassword })
			});

			const data = await res.json();

			if (!res.ok) {
				changeError = data.error || '更換失敗';
				return;
			}

			showChangeCredentials = false;
			goto(redirectAfterChange);
		} catch {
			changeError = '發生錯誤，請稍後再試';
		} finally {
			changing = false;
		}
	}
</script>

<svelte:head>
	<title>登入 - {page.data.siteName}</title>
</svelte:head>

<Dialog.Root bind:open={showChangeCredentials}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>請更換您的帳號與密碼</Dialog.Title>
			<Dialog.Description>
				這是您第一次登入，為了安全起見，請設定新的電子郵件與密碼後才能繼續使用系統。
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleChangeCredentials} class="space-y-4 pt-2">
			<div class="space-y-2">
				<Label for="new-email">電子郵件</Label>
				<Input id="new-email" type="email" bind:value={newEmail} required disabled={changing} />
			</div>
			<div class="space-y-2">
				<Label for="new-password">新密碼（至少 8 個字元）</Label>
				<Input
					id="new-password"
					type="password"
					bind:value={newPassword}
					required
					minlength={8}
					disabled={changing}
				/>
			</div>
			<div class="space-y-2">
				<Label for="confirm-password">確認新密碼</Label>
				<Input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					required
					disabled={changing}
				/>
			</div>
			{#if changeError}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{changeError}</div>
			{/if}
			<Dialog.Footer>
				<Button type="submit" class="w-full" disabled={changing}>
					{changing ? '更新中...' : '確認更換'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">{page.data.siteName}</Card.Title>
			<Card.Description>登入您的帳戶</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="email">電子郵件</Label>
					<Input
						id="email"
						type="text"
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
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? '登入中...' : '登入'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="flex justify-center">
			<p class="text-sm text-muted-foreground">
				還沒有帳戶？
				<a href="/register" class="text-primary hover:underline">註冊</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
