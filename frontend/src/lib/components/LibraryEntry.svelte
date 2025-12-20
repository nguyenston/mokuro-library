<script lang="ts">
	import { type Snippet } from 'svelte';

	// --- Types ---
	interface EntryData {
		id: string;
		title: string | null;
		folderName: string;
		coverUrl?: string | null;
	}

	interface ProgressData {
		percent: number;
		isRead: boolean;
		showBar: boolean;
	}

	// --- Props ---
	let {
		entry,
		type = 'volume',
		viewMode = 'grid',
		isSelected = false,
		isSelectionMode = false,
		progress = { percent: 0, isRead: false, showBar: false },
		href = '#',
		mainStat = '',
		subStat = '',
		lastReadText = '1 day ago',
		onSelect,
		circleAction,
		titleAction,
		listActions,
		imageOverlay
	} = $props<{
		entry: EntryData;
		type?: 'series' | 'volume';
		viewMode?: 'grid' | 'list';
		isSelected?: boolean;
		isSelectionMode?: boolean;
		progress?: ProgressData;
		href?: string;
		mainStat?: string | number;
		subStat?: string;
		lastReadText?: string;
		onSelect?: (e: MouseEvent) => void;
		circleAction?: Snippet;
		titleAction?: Snippet;
		listActions?: Snippet;
		imageOverlay?: Snippet;
	}>();

	// Determine read status for badge
	const getStatusBadge = () => {
		if (progress.isRead) return { label: 'READ', color: 'bg-status-success' };
		if (progress.percent > 0) return { label: 'READING', color: 'bg-accent' };
		return { label: 'UNREAD', color: 'bg-status-unread' };
	};

	const status = $derived(getStatusBadge());

	const gridAspectClass = type === 'series' ? 'aspect-[7/11]' : 'aspect-[2/3]';
</script>

{#if viewMode === 'grid'}
	<div
		class={`group relative bg-theme-surface rounded-xl border flex flex-col transition-all duration-300 overflow-hidden shadow-lg hover:shadow-xl
    ${
			isSelected
				? 'border-accent ring-1 ring-accent shadow-[0_0_20px_rgba(99,102,241,0.4)] z-30 scale-[1.02]'
				: 'border-theme-border-light hover:border-theme-secondary/50 z-10'
		}
    ${isSelectionMode && !isSelected ? 'opacity-40 grayscale-[0.4]' : 'opacity-100'}`}
	>
		<a
			{href}
			onclick={onSelect}
			class="absolute inset-0 z-10"
			aria-label={`View ${entry.title || entry.folderName}`}
		></a>

		<div
			class={`${gridAspectClass} w-full bg-theme-main relative overflow-hidden pointer-events-none z-10`}
		>
			{#if entry.coverUrl}
				<img
					src={entry.coverUrl}
					alt={entry.folderName}
					loading="lazy"
					class="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
				/>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center text-theme-tertiary bg-theme-surface font-bold text-xl"
				>
					{entry.folderName[0]}
				</div>
			{/if}

			<div
				class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-40 h-20"
			></div>
			<div
				class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10"
			></div>
			<div class="absolute bottom-0 left-0 right-0 p-3 pb-2 z-20 flex flex-col justify-end">
				<div class="font-bold text-white text-sm leading-tight line-clamp-2 drop-shadow-md">
					{entry.title || entry.folderName}
				</div>
			</div>
		</div>

		<div
			class="px-3 py-2 bg-theme-surface flex items-center justify-between gap-3 relative z-20 border-t border-white/5"
		>
			<div class="flex flex-col gap-1.5 min-w-0 flex-1">
				{#if mainStat}
					<div
						class={`text-[12px] font-bold uppercase tracking-[0.1em] leading-none ${
							status.color === 'bg-status-success'
								? 'text-status-success'
								: status.color === 'bg-accent'
									? 'text-accent'
									: 'text-status-unread'
						}`}
					>
						{mainStat}
					</div>

					<div class="w-full h-[1px] bg-theme-secondary/10"></div>
				{/if}

				<div class="text-[11px] text-theme-secondary font-medium leading-none">
					{subStat}
				</div>
			</div>

			<div class="relative grid place-items-center w-11 h-11 flex-shrink-0">
				{#if !isSelectionMode && circleAction}
					<div class="z-30 col-start-1 row-start-1 pointer-events-auto">
						{@render circleAction()}
					</div>
				{/if}

				<svg
					class="col-start-1 row-start-1 w-11 h-11 transform -rotate-90 overflow-visible pointer-events-none"
					viewBox="0 0 44 44"
				>
					<circle
						cx="22"
						cy="22"
						r="18"
						stroke="currentColor"
						stroke-width="3.5"
						fill="none"
						class="text-theme-border-light"
					/>
					<circle
						cx="22"
						cy="22"
						r="18"
						stroke="currentColor"
						stroke-width="3.5"
						fill="none"
						class="neon-glow transition-all duration-700 {status.color === 'bg-status-success'
							? 'text-status-success'
							: status.color === 'bg-accent'
								? 'text-accent'
								: 'text-status-unread'}"
						stroke-dasharray="113.10"
						stroke-dashoffset={113.1 - (113.1 * (progress.isRead ? 100 : progress.percent)) / 100}
						stroke-linecap="round"
					/>
				</svg>
			</div>
		</div>
	</div>
{:else}
	<div
		class={`group relative bg-theme-surface rounded-xl border flex items-center transition-all duration-300 overflow-hidden h-32 shadow-md hover:shadow-lg
    ${
			isSelected
				? 'border-accent ring-1 ring-accent shadow-[0_0_20px_rgba(99,102,241,0.4)] z-30'
				: 'border-theme-border-light hover:border-theme-secondary/50 z-10'
		}
    ${isSelectionMode && !isSelected ? 'opacity-40 grayscale-[0.4]' : 'opacity-100'}`}
	>
		<a
			{href}
			onclick={onSelect}
			class="absolute inset-0 z-0 block"
			aria-label={`View ${entry.title || entry.folderName}`}
		></a>

		<div
			class="relative h-full aspect-[7/11] bg-theme-main flex-shrink-0 pointer-events-none border-r border-theme-border overflow-hidden z-10"
		>
			{#if entry.coverUrl}
				<img
					src={entry.coverUrl}
					alt=""
					class="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
				/>
			{:else}
				<div
					class="h-full w-full flex items-center justify-center text-2xl font-bold text-theme-tertiary"
				>
					#
				</div>
			{/if}
			<div
				class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"
			></div>
		</div>

		<div
			class="flex-grow min-w-0 py-4 px-4 sm:px-6 pointer-events-none z-10 flex flex-col justify-center"
		>
			<div class="flex items-start gap-2">
				<div
					class="text-base sm:text-lg font-bold text-theme-primary transition-colors group-hover:text-accent
                line-clamp-2 leading-tight flex-grow"
				>
					{entry.title || entry.folderName}
				</div>

				{#if titleAction}
					<div
						class="pointer-events-auto relative z-20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
					>
						{@render titleAction()}
					</div>
				{/if}
			</div>

			<div class="text-xs sm:text-sm flex flex-wrap gap-x-4 gap-y-0.5 items-center mt-1.5">
				<span
					class={`font-bold transition-colors ${progress.isRead ? 'text-status-success' : 'text-theme-secondary'}`}
				>
					{mainStat}
				</span>
				{#if subStat}
					<span class="text-theme-tertiary font-medium whitespace-nowrap">• {subStat}</span>
				{/if}
			</div>
		</div>

		{#if !isSelectionMode}
			<div
				class="flex items-center gap-4 pr-5 pl-5 border-l border-theme-border-light h-12 relative z-20 flex-shrink-0"
			>
				{@render listActions?.()}
			</div>
		{/if}

		{#if progress.showBar || progress.isRead}
			<div class="absolute bottom-0 left-[81.5px] right-0 h-1 bg-black/40 z-20">
				<div
					class="neon-glow h-full transition-all duration-700 {progress.isRead
						? 'bg-status-success text-status-success'
						: 'bg-accent text-accent'}"
					style="width: {progress.isRead ? 100 : progress.percent}%"
				></div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.neon-glow {
		/* Layer 1: Sharp definition (The "hot" edge) */
		filter: drop-shadow(0 0 1px currentColor) /* Layer 2: Immediate bloom */
			drop-shadow(0 0 3px currentColor)
			/* Layer 3: The fast-decaying outer edge (reduced from 12px to 7px) */
			drop-shadow(0 0 7px currentColor);
	}
</style>
