<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let { meta } = $props<{
		meta: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}>();

	// --- Internal State ---
	let isLimitOpen = $state(false);
	let limitMenuRef: HTMLDivElement | undefined = $state();
	const availableLimits = [10, 20, 50, 100];

	// --- Helpers ---
	function getPageNumbers(current: number, total: number) {
		if (total <= 1) return [1];

		const delta = 1;
		const range = [];
		const rangeWithDots = [];
		let l;

		for (let i = 1; i <= total; i++) {
			if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
				range.push(i);
			}
		}

		for (let i of range) {
			if (l) {
				if (i - l === 2) {
					rangeWithDots.push(l + 1);
				} else if (i - l !== 1) {
					rangeWithDots.push('...');
				}
			}
			rangeWithDots.push(i);
			l = i;
		}

		return rangeWithDots;
	}

	let pages = $derived(getPageNumbers(meta.page, meta.totalPages));

	// --- Handlers ---
	const updateParams = (changes: Record<string, string>) => {
		const params = new URLSearchParams(page.url.searchParams);
		for (const [key, value] of Object.entries(changes)) {
			params.set(key, value);
		}
		goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	};

	const setPage = (p: number) => {
		if (p < 1 || p > meta.totalPages) return;
		updateParams({ page: p.toString() });
	};

	const setLimit = (l: number) => {
		if (browser) {
			localStorage.setItem('pagination_limit', l.toString());
		}
		updateParams({ limit: l.toString(), page: '1' });
		isLimitOpen = false;
	};

	// Restore preference
	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem('pagination_limit');
			const current = page.url.searchParams.get('limit');
			if (saved && !current && Number(saved) !== meta.limit) {
				updateParams({ limit: saved });
			}
		}
	});

	// Outside Click
	function handleOutsideClick(event: MouseEvent) {
		if (isLimitOpen && limitMenuRef && !limitMenuRef.contains(event.target as Node)) {
			isLimitOpen = false;
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

{#if meta.total >= 0}
	<div class="flex justify-center relative z-10">
		<nav
			class="flex items-center gap-1 p-1.5 pl-4 rounded-full bg-theme-surface/60 backdrop-blur-md border border-white/10 shadow-2xl ring-1 ring-black/5"
			aria-label="Pagination"
		>
			<div
				class="hidden sm:block text-[12px] font-bold text-theme-tertiary uppercase tracking-wider mr-2 select-none"
			>
				<span class="text-theme-primary">{(meta.page - 1) * meta.limit + 1}</span>
				-
				<span class="text-theme-primary">{Math.min(meta.page * meta.limit, meta.total)}</span>
				of
				<span class="text-theme-primary">{meta.total}</span>
			</div>

			<div class="hidden sm:block w-px h-5 bg-white/10 mr-1"></div>

			<button
				onclick={() => setPage(meta.page - 1)}
				disabled={meta.page === 1 || meta.totalPages <= 1}
				class="w-9 h-9 flex items-center justify-center rounded-full text-theme-secondary transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
				aria-label="Previous Page"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
			</button>

			{#each pages as pageNum}
				{#if pageNum === '...'}
					<div
						class="w-8 h-9 flex items-center justify-center text-theme-secondary/50 font-bold select-none text-xs tracking-widest"
					>
						•••
					</div>
				{:else}
					<button
						onclick={() => setPage(Number(pageNum))}
						disabled={meta.totalPages <= 1}
						class={`min-w-[36px] h-9 px-3 flex items-center justify-center rounded-full text-sm font-bold transition-all duration-300
                        ${
													meta.page === pageNum
														? 'bg-accent text-white shadow-lg shadow-accent/25 scale-105 cursor-default'
														: 'text-theme-secondary hover:bg-white/10 hover:text-white'
												}`}
					>
						{pageNum}
					</button>
				{/if}
			{/each}

			<button
				onclick={() => setPage(meta.page + 1)}
				disabled={meta.page === meta.totalPages || meta.totalPages <= 1}
				class="w-9 h-9 flex items-center justify-center rounded-full text-theme-secondary transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
				aria-label="Next Page"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
				>
			</button>

			<div class="w-px h-5 bg-white/10 mx-1"></div>

			<div class="relative" bind:this={limitMenuRef}>
				<button
					onclick={() => (isLimitOpen = !isLimitOpen)}
					class="h-9 px-4 flex items-center gap-2 rounded-full text-[12px] font-bold text-theme-secondary hover:text-white hover:bg-white/5 transition-colors"
					title="Rows per page"
				>
					<span>{meta.limit}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class={`transition-transform duration-200 ${isLimitOpen ? 'rotate-180' : ''}`}
						><path d="m6 9 6 6 6-6" /></svg
					>
				</button>

				{#if isLimitOpen}
					<div
						class="absolute bottom-full right-0 mb-2 w-24 py-1 bg-theme-surface border border-theme-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50"
					>
						{#each availableLimits as opt}
							<button
								onclick={() => setLimit(opt)}
								class={`w-full px-3 py-2 text-center text-[12px] font-bold transition-colors
                                ${
																	meta.limit === opt
																		? 'bg-accent-surface text-accent'
																		: 'text-theme-secondary hover:text-white hover:bg-white/5'
																}`}
							>
								{opt}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</nav>
	</div>
{/if}
