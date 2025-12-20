<script lang="ts">
	// --- Types ---
	interface Series {
		id: string;
		title: string | null;
		folderName: string;
		description: string | null;
		coverPath: string | null;
	}

	interface SeriesStats {
		volsRead: number;
		totalVols: number;
		totalCharsRead: number;
		totalTime: number;
	}

	let {
		series,
		stats,
		coverRefreshTrigger = 0,
		onCoverUpload,
		onEditMetadata,
		onMenuClick
	} = $props<{
		series: Series;
		stats: SeriesStats;
		coverRefreshTrigger?: number;
		onCoverUpload: (e: Event, fileInput: HTMLInputElement | undefined) => void;
		onEditMetadata: () => void;
		onMenuClick: (e: MouseEvent) => void;
	}>();

	// --- Helpers ---
	const formatTime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	};

	let displayTitle = $derived(series.title ?? series.folderName);
	let displaySubtitle = '';
	let fileInput: HTMLInputElement | undefined = $state();
</script>

<div
	class="relative w-full bg-theme-surface/40 backdrop-blur-3xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl group mb-10"
>
	<div class="absolute inset-0 z-0 opacity-40 pointer-events-none select-none overflow-hidden">
		{#if series.coverPath}
			<img
				src={`/api/files/series/${series.id}/cover?t=${coverRefreshTrigger}`}
				alt=""
				class="w-full h-full object-cover blur-[100px] scale-150 opacity-60"
			/>
		{:else}
			<div class="w-full h-full bg-gradient-to-br from-theme-surface to-bg-main"></div>
		{/if}
		<div
			class="absolute inset-0 bg-gradient-to-t from-theme-surface via-theme-surface/60 to-transparent"
		></div>
	</div>

	<div class="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row gap-8 lg:gap-12">
		<div class="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-56">
			<div
				class="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-accent/40 relative group/cover ring-1 ring-accent/20 bg-theme-main"
			>
				{#if series.coverPath}
					<img
						src={`/api/files/series/${series.id}/cover?t=${coverRefreshTrigger}`}
						alt={series.folderName}
						class="w-full h-full object-cover transition-transform duration-500 group-hover/cover:scale-105"
					/>
				{:else}
					<div
						class="w-full h-full flex items-center justify-center text-4xl font-serif text-theme-tertiary"
					>
						{series.folderName.charAt(0)}
					</div>
				{/if}

				<button
					onclick={() => fileInput?.click()}
					class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-primary mb-2"
						><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
							points="17 8 12 3 7 8"
						/><line x1="12" x2="12" y1="3" y2="15" /></svg
					>
					<span class="text-xs font-bold uppercase tracking-wider text-theme-primary"
						>Change Cover</span
					>
				</button>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					bind:this={fileInput}
					onchange={(e: Event) => onCoverUpload(e, fileInput)}
				/>
			</div>
		</div>

		<div class="flex-grow flex flex-col min-w-0 text-center md:text-left">
			<div class="relative pr-0 md:pr-12">
				<h1
					class="text-3xl sm:text-4xl lg:text-5xl font-bold text-theme-primary leading-tight tracking-tight drop-shadow-lg mb-2"
				>
					{displayTitle}
				</h1>

				{#if displaySubtitle}
					<h2
						class="text-lg sm:text-xl font-medium text-theme-secondary font-serif tracking-wide mb-4"
					>
						{displaySubtitle}
					</h2>
				{/if}

				<button
					onclick={onEditMetadata}
					class="absolute top-0 right-0 p-2 text-theme-secondary hover:text-theme-primary hover:bg-white/10 rounded-lg transition-colors hidden md:block"
					title="Edit Metadata"
				>
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
						><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
							d="m15 5 4 4"
						/></svg
					>
				</button>
			</div>

			{#if series.description}
				<p
					class="text-theme-primary/90 leading-relaxed max-w-3xl mb-8 line-clamp-4 md:line-clamp-none text-sm sm:text-base mx-auto md:mx-0 whitespace-pre-wrap"
				>
					{series.description}
				</p>
			{:else}
				<p class="text-theme-secondary/50 text-sm italic mb-8">No description available.</p>
			{/if}

			<div class="mt-auto space-y-6">
				<div class="flex flex-wrap items-center justify-center md:justify-start gap-3">
					<button
						onclick={onMenuClick}
						class="flex items-center gap-2 px-5 py-2.5 bg-theme-surface hover:bg-theme-surface-hover border border-white/10 rounded-full text-sm font-medium text-theme-primary transition-all hover:shadow-lg hover:border-accent/50 active:scale-95"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
								cx="12"
								cy="19"
								r="1"
							/></svg
						>
						Series Actions
					</button>

					<button
						onclick={onEditMetadata}
						class="md:hidden flex items-center gap-2 px-5 py-2.5 bg-transparent border border-white/10 rounded-full text-sm font-medium text-theme-secondary hover:text-theme-primary hover:bg-white/5 transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
								d="m15 5 4 4"
							/></svg
						>
						Edit Metadata
					</button>
				</div>

				<div class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-left">
					<div
						class="bg-theme-surface/60 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/15 hover:border-white/30 flex items-center gap-3 sm:gap-4 shadow-sm hover:bg-theme-surface/80 transition-colors"
					>
						<div class="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
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
								><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg
							>
						</div>
						<div class="min-w-0">
							<div
								class="text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-0.5"
							>
								Volumes
							</div>
							<div class="text-sm sm:text-lg font-bold text-theme-primary truncate">
								{stats.volsRead} / {stats.totalVols}
							</div>
						</div>
					</div>

					<div
						class="bg-theme-surface/60 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/15 hover:border-white/30 flex items-center gap-3 sm:gap-4 shadow-sm hover:bg-theme-surface/80 transition-colors"
					>
						<div class="p-2.5 rounded-lg bg-stat-metadata/10 text-stat-metadata">
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
								><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line
									x1="12"
									x2="12"
									y1="4"
									y2="20"
								/></svg
							>
						</div>
						<div class="min-w-0">
							<div
								class="text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-0.5"
							>
								Characters
							</div>
							<div class="text-sm sm:text-lg font-bold text-theme-primary truncate">
								{stats.totalCharsRead.toLocaleString()}
							</div>
						</div>
					</div>

					<div
						class="col-span-2 lg:col-span-1 bg-theme-surface/60 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/15 hover:border-white/30 flex items-center gap-3 sm:gap-4 shadow-sm hover:bg-theme-surface/80 transition-colors"
					>
						<div class="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
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
								><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg
							>
						</div>
						<div class="min-w-0">
							<div
								class="text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-0.5"
							>
								Time Read
							</div>
							<div class="text-sm sm:text-lg font-bold text-theme-primary truncate">
								{formatTime(stats.totalTime)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
