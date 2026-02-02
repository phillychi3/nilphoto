<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';

	interface StorageConfig {
		id: string;
		name: string;
		provider: string;
	}

	interface BackupRecord {
		id: string;
		photoId: string;
		status: 'pending' | 'in_progress' | 'completed' | 'failed';
		backupPath: string | null;
		errorMessage: string | null;
		createdAt: string;
		completedAt: string | null;
		photo: { id: string; originalFilename: string; thumbnailPath: string | null; storagePath: string };
		storageConfig: { id: string; name: string; provider: string };
	}

	interface Schedule {
		id: string;
		storageConfigId: string;
		enabled: boolean;
		frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
		retentionDays: number;
		lastRunAt: string | null;
		nextRunAt: string | null;
		createdAt: string;
		storageConfig: { id: string; name: string; provider: string };
	}

	interface Stats {
		total: number;
		completed: number;
		failed: number;
		pending: number;
		totalPhotos: number;
	}

	let backupsList = $state<BackupRecord[]>([]);
	let schedules = $state<Schedule[]>([]);
	let storageConfigs = $state<StorageConfig[]>([]);
	let stats = $state<Stats>({ total: 0, completed: 0, failed: 0, pending: 0, totalPhotos: 0 });
	let loading = $state(true);
	let statusFilter = $state('');

	// Manual backup dialog
	let showBackupDialog = $state(false);
	let backupConfigId = $state('');
	let backingUp = $state(false);
	let backupResult = $state('');

	// Schedule dialog
	let showScheduleDialog = $state(false);
	let scheduleConfigId = $state('');
	let scheduleFrequency = $state('daily');
	let scheduleRetention = $state('30');
	let savingSchedule = $state(false);

	onMount(async () => {
		await Promise.all([loadBackups(), loadSchedules(), loadStorageConfigs()]);
		loading = false;
	});

	async function loadBackups() {
		const params = new URLSearchParams();
		params.set('limit', '50');
		if (statusFilter) params.set('status', statusFilter);

		const res = await fetch(`/api/backups?${params}`);
		if (res.ok) {
			const data = await res.json();
			backupsList = data.backups || [];
			stats = data.stats;
		}
	}

	async function loadSchedules() {
		const res = await fetch('/api/backup-schedules');
		if (res.ok) {
			const data = await res.json();
			schedules = data.schedules || [];
		}
	}

	async function loadStorageConfigs() {
		const res = await fetch('/api/storage-configs');
		if (res.ok) {
			const data = await res.json();
			storageConfigs = data.configs || [];
		}
	}

	async function triggerBackup() {
		if (!backupConfigId) return;
		backingUp = true;
		backupResult = '';
		try {
			const res = await fetch('/api/backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ storageConfigId: backupConfigId })
			});
			const data = await res.json();
			backupResult = data.message || (res.ok ? '備份已排程' : data.error || '備份失敗');
			if (res.ok) {
				await loadBackups();
			}
		} finally {
			backingUp = false;
		}
	}

	async function createSchedule() {
		if (!scheduleConfigId) return;
		savingSchedule = true;
		try {
			const res = await fetch('/api/backup-schedules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					storageConfigId: scheduleConfigId,
					frequency: scheduleFrequency,
					retentionDays: parseInt(scheduleRetention) || 30
				})
			});
			if (res.ok) {
				showScheduleDialog = false;
				await loadSchedules();
			}
		} finally {
			savingSchedule = false;
		}
	}

	async function toggleSchedule(schedule: Schedule) {
		await fetch('/api/backup-schedules', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: schedule.id, enabled: !schedule.enabled })
		});
		await loadSchedules();
	}

	async function deleteSchedule(id: string) {
		if (!confirm('確定要刪除此備份排程？')) return;
		await fetch('/api/backup-schedules', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await loadSchedules();
	}

	function formatDate(d: string | null): string {
		if (!d) return '-';
		return new Date(d).toLocaleString('zh-TW');
	}

	const freqLabels: Record<string, string> = {
		hourly: '每小時',
		daily: '每天',
		weekly: '每週',
		monthly: '每月'
	};

	const statusLabels: Record<string, string> = {
		pending: '等待中',
		in_progress: '備份中',
		completed: '已完成',
		failed: '失敗'
	};

	const statusColors: Record<string, string> = {
		pending: 'bg-yellow-500/10 text-yellow-500',
		in_progress: 'bg-blue-500/10 text-blue-500',
		completed: 'bg-green-500/10 text-green-500',
		failed: 'bg-red-500/10 text-red-500'
	};
</script>

<svelte:head>
	<title>備份管理 - NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold">備份管理</h1>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => { scheduleConfigId = storageConfigs[0]?.id || ''; showScheduleDialog = true; }}>
				新增排程
			</Button>
			<Button onclick={() => { backupConfigId = storageConfigs[0]?.id || ''; backupResult = ''; showBackupDialog = true; }}>
				手動備份
			</Button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else}
		<!-- Stats -->
		<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div class="rounded-lg border p-4">
				<p class="text-sm text-muted-foreground">照片總數</p>
				<p class="text-2xl font-bold">{stats.totalPhotos}</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm text-muted-foreground">已備份</p>
				<p class="text-2xl font-bold text-green-500">{stats.completed}</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm text-muted-foreground">等待中</p>
				<p class="text-2xl font-bold text-yellow-500">{stats.pending}</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm text-muted-foreground">失敗</p>
				<p class="text-2xl font-bold text-red-500">{stats.failed}</p>
			</div>
		</div>

		<!-- Backup Schedules -->
		<div class="mb-8">
			<h2 class="mb-3 text-lg font-semibold">備份排程</h2>
			{#if schedules.length === 0}
				<div class="rounded-lg border p-6 text-center text-muted-foreground">
					尚未設定備份排程
				</div>
			{:else}
				<div class="space-y-2">
					{#each schedules as schedule}
						<div class="flex items-center justify-between rounded-lg border p-3">
							<div class="flex items-center gap-3">
								<div
									class="h-2 w-2 rounded-full {schedule.enabled ? 'bg-green-500' : 'bg-muted-foreground'}"
								></div>
								<div>
									<p class="text-sm font-medium">
										{schedule.storageConfig.name}
										<span class="ml-1 text-xs text-muted-foreground">({schedule.storageConfig.provider})</span>
									</p>
									<p class="text-xs text-muted-foreground">
										{freqLabels[schedule.frequency]} &middot; 保留 {schedule.retentionDays} 天
										{#if schedule.nextRunAt}
											&middot; 下次執行: {formatDate(schedule.nextRunAt)}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onclick={() => toggleSchedule(schedule)}
								>
									{schedule.enabled ? '停用' : '啟用'}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="text-destructive hover:text-destructive"
									onclick={() => deleteSchedule(schedule.id)}
								>
									刪除
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Backup History -->
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">備份紀錄</h2>
				<div class="flex items-center gap-1">
					{#each ['', 'pending', 'completed', 'failed'] as status}
						<button
							class="rounded-full px-3 py-1 text-xs transition-colors {statusFilter === status
								? 'bg-primary text-primary-foreground'
								: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
							onclick={() => { statusFilter = status; loadBackups(); }}
						>
							{status ? statusLabels[status] : '全部'}
						</button>
					{/each}
				</div>
			</div>
			{#if backupsList.length === 0}
				<div class="rounded-lg border p-6 text-center text-muted-foreground">
					沒有備份紀錄
				</div>
			{:else}
				<div class="overflow-hidden rounded-lg border">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="px-4 py-2 text-left font-medium text-muted-foreground">照片</th>
								<th class="px-4 py-2 text-left font-medium text-muted-foreground">儲存服務</th>
								<th class="px-4 py-2 text-left font-medium text-muted-foreground">狀態</th>
								<th class="px-4 py-2 text-left font-medium text-muted-foreground">時間</th>
							</tr>
						</thead>
						<tbody>
							{#each backupsList as backup}
								<tr class="border-b last:border-0">
									<td class="px-4 py-2">
										<span class="text-xs">{backup.photo.originalFilename}</span>
									</td>
									<td class="px-4 py-2">
										<span class="text-xs text-muted-foreground">
											{backup.storageConfig.name}
										</span>
									</td>
									<td class="px-4 py-2">
										<span class="rounded-full px-2 py-0.5 text-[10px] {statusColors[backup.status]}">
											{statusLabels[backup.status]}
										</span>
										{#if backup.errorMessage}
											<p class="mt-0.5 text-[10px] text-red-400">{backup.errorMessage}</p>
										{/if}
									</td>
									<td class="px-4 py-2 text-xs text-muted-foreground">
										{formatDate(backup.createdAt)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Manual Backup Dialog -->
<Dialog.Root bind:open={showBackupDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>手動備份</Dialog.Title>
			<Dialog.Description>選擇備份目標儲存服務，系統將備份所有尚未備份的照片</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label>備份到</Label>
				<select
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					bind:value={backupConfigId}
				>
					{#each storageConfigs as config}
						<option value={config.id}>{config.name} ({config.provider})</option>
					{/each}
				</select>
			</div>
			{#if backupResult}
				<p class="text-sm text-muted-foreground">{backupResult}</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showBackupDialog = false)}>關閉</Button>
			<Button onclick={triggerBackup} disabled={backingUp || !backupConfigId}>
				{backingUp ? '排程中...' : '開始備份'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Schedule Dialog -->
<Dialog.Root bind:open={showScheduleDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>新增備份排程</Dialog.Title>
			<Dialog.Description>設定自動備份排程</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label>備份到</Label>
				<select
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					bind:value={scheduleConfigId}
				>
					{#each storageConfigs as config}
						<option value={config.id}>{config.name} ({config.provider})</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label>備份頻率</Label>
				<select
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					bind:value={scheduleFrequency}
				>
					<option value="hourly">每小時</option>
					<option value="daily">每天</option>
					<option value="weekly">每週</option>
					<option value="monthly">每月</option>
				</select>
			</div>
			<div class="space-y-2">
				<Label for="retention">保留天數</Label>
				<Input id="retention" type="number" bind:value={scheduleRetention} placeholder="30" />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showScheduleDialog = false)}>取消</Button>
			<Button onclick={createSchedule} disabled={savingSchedule || !scheduleConfigId}>
				{savingSchedule ? '建立中...' : '建立排程'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
