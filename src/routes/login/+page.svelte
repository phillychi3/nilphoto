<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

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

			// Redirect to the original page or home
			const redirectTo = $page.url.searchParams.get('redirect') || '/';
			goto(redirectTo);
		} catch (err) {
			error = '發生錯誤，請稍後再試';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>登入 - NILPhoto</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">NILPhoto</Card.Title>
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
