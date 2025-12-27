<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { apiFetch } from '$lib/api';
	import type { Series as GlobalSeries, Volume as GlobalVolume, LibraryItem } from '$lib/types';
	import type { AuthUser } from '$lib/authStore';
	import { uiState } from '$lib/states/uiState.svelte';
	import { metadataOps } from '$lib/states/metadataOperations.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LibraryActionBar from '$lib/components/LibraryActionBar.svelte';
	import LibraryEntry from '$lib/components/LibraryEntry.svelte';
	import EditSeriesModal from '$lib/components/EditSeriesModal.svelte';
	import type { FilterStatus, FilterMissing, FilterOrganization } from '$lib/states/uiState.svelte';
	import { formatLastReadDate } from '$lib/utils/dateHelpers';
	import backgroundImage from './background.png';

	// --- Type Definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
	}

	type Volume = Pick<GlobalVolume, 'pageCount' | 'progress'>;

	type Series = Omit<GlobalSeries, 'volumes'> & {
		volumes: Volume[];
	};

	// --- Auth State ---
	let isRegisterMode = $state(false);
	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isLoading = $state(false);
	let showCard = $state(false);
	let floatingElements = $state<{ id: number; delay: number; duration: number; x: number; y: number }[]>([]);

	// --- Library State ---
	let library = $state<Series[]>([]);
	let meta = $state({ total: 0, page: 1, limit: 24, totalPages: 1 });
	let isLoadingLibrary = $state(true);
	let libraryError = $state<string | null>(null);

	let isEditModalOpen = $state(false);
	let editModalTarget: Series | null = $state(null);

	// --- Auth Functions ---
	function toggleMode() {
		isRegisterMode = !isRegisterMode;
		username = '';
		password = '';
		confirmPassword = '';
		error = null;
		successMessage = null;
	}

	async function handleLogin() {
		isLoading = true;
		error = null;

		try {
			const userData = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: { username, password }
			});

			user.set(userData as AuthUser);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	}

	async function handleRegister() {
		isLoading = true;
		error = null;
		successMessage = null;

		if (password.length < 6) {
			error = 'Password must be at least 6 characters long.';
			isLoading = false;
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match.';
			isLoading = false;
			return;
		}

		try {
			// Register the account
			await apiFetch('/api/auth/register', {
				method: 'POST',
				body: { username, password }
			});

			// Automatically log in after successful registration
			const userData = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: { username, password }
			});

			// Update the global store with the user data
			user.set(userData as AuthUser);

			// The page will automatically show the library view when user is set
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	}

	function handleSubmit() {
		if (isRegisterMode) {
			handleRegister();
		} else {
			handleLogin();
		}
	}

	// --- Helper: Calculate Series Progress ---
	const getSeriesProgress = (series: Series) => {
		let totalPages = 0;
		let readPages = 0;
		let completedCount = 0;

		if (!series.volumes || series.volumes.length === 0) return { percent: 0, isRead: false };

		for (const vol of series.volumes) {
			const pCount = vol.pageCount || 0;
			totalPages += pCount;

			const progress = vol.progress?.[0];
			if (progress) {
				if (progress.completed) {
					readPages += pCount;
					completedCount += 1;
				} else {
					readPages += progress.page || 0;
				}
			}
		}

		if (totalPages === 0) return { percent: 0, isRead: false };
		return {
			percent: Math.min(100, Math.max(0, (readPages / totalPages) * 100)),
			isRead: completedCount === series.volumes.length
		};
	};

	// --- Initialization & URL Hydration ---

	onMount(() => {
		// Only initialize library context if user is authenticated
		if ($user) {
			uiState.setContext('library', 'Library', [
				{ key: 'title', label: 'Title' },
				{ key: 'updated', label: 'Last Updated' },
				{ key: 'lastRead', label: 'Recent' }
			]);
		} else {
			// Initialize auth UI
			showCard = true;
			floatingElements = Array.from({ length: 8 }, (_, i) => ({
				id: i,
				delay: Math.random() * 2,
				duration: 15 + Math.random() * 10,
				x: Math.random() * 100,
				y: Math.random() * 100
			}));
		}
	});

	onMount(() => {
		// Hydrate State from URL (only if authenticated)
		if (browser && $user) {
			const params = page.url.searchParams;

			// Search
			const q = params.get('q');
			if (q !== null && q !== uiState.searchQuery) {
				uiState.searchQuery = q;
			}

			// Sort & Order (Split params)
			const sort = params.get('sort');
			const order = params.get('order');

			if (sort) {
				if (sort === 'updated') uiState.sortKey = 'updated';
				else if (sort === 'recent') uiState.sortKey = 'lastRead';
				else uiState.sortKey = 'title';
			}

			if (order === 'asc' || order === 'desc') {
				uiState.sortOrder = order;
			}

			// Filters
			const status = params.get('status');
			if (status && uiState.filterStatus !== status) {
				uiState.filterStatus = status as FilterStatus;
			}

			const bookmarked = params.get('bookmarked');
			if (bookmarked === 'true') {
				uiState.filterBookmarked = true;
			}

			// Organization
			const isOrganized = params.get('is_organized');
			if (isOrganized === 'true') uiState.filterOrganization = 'organized';
			else if (isOrganized === 'false') uiState.filterOrganization = 'unorganized';
			else uiState.filterOrganization = 'all';

			// Missing Metadata
			const missing = params.get('filter_missing');
			if (missing) {
				uiState.filterMissing = missing as FilterMissing;
			}
		}
	});

	// --- Data Fetching & URL Sync ---
	$effect(() => {
		if ($user && browser) {
			// Dependency tracking: include libraryVersion
			const _version = uiState.libraryVersion;

			const currentParams = new URLSearchParams(page.url.searchParams);
			const newParams = new URLSearchParams(currentParams);

			// A. Construct Query Params (Map UI -> Backend)

			// 1. Search
			if (uiState.searchQuery) newParams.set('q', uiState.searchQuery);
			else newParams.delete('q');

			// 2. Sort
			let backendSort = 'title';
			if (uiState.sortKey === 'updated') backendSort = 'updated';
			if (uiState.sortKey === 'lastRead') backendSort = 'recent';

			newParams.set('sort', backendSort);
			newParams.set('order', uiState.sortOrder);

			// 3. Status
			if (uiState.filterStatus !== 'all') {
				newParams.set('status', uiState.filterStatus);
			} else {
				newParams.delete('status');
			}

			// 4. Bookmarked
			if (uiState.filterBookmarked) {
				newParams.set('bookmarked', 'true');
			} else {
				newParams.delete('bookmarked');
			}

			// 5. Organization
			if (uiState.filterOrganization !== 'all') {
				newParams.set(
					'is_organized',
					uiState.filterOrganization === 'organized' ? 'true' : 'false'
				);
			} else {
				newParams.delete('is_organized');
			}

			// 6. Missing Metadata
			if (uiState.filterMissing !== 'none') {
				newParams.set('filter_missing', uiState.filterMissing);
			} else {
				newParams.delete('filter_missing');
			}

			// B. Handle Pagination Reset
			const criteriaChanged =
				currentParams.get('q') !== newParams.get('q') ||
				currentParams.get('sort') !== newParams.get('sort') ||
				currentParams.get('order') !== newParams.get('order') ||
				currentParams.get('status') !== newParams.get('status') ||
				currentParams.get('bookmarked') !== newParams.get('bookmarked') ||
				currentParams.get('is_organized') !== newParams.get('is_organized') ||
				currentParams.get('filter_missing') !== newParams.get('filter_missing');

			if (criteriaChanged) {
				newParams.set('page', '1');
			}

			// C. Update URL
			const queryString = newParams.toString();
			if (queryString !== currentParams.toString()) {
				goto(`?${queryString}`, { replaceState: true, keepFocus: true, noScroll: true });
			}

			// D. Trigger Fetch
			fetchLibrary(`?${queryString}`);
		}
	});

	// CLEANUP: Flush pending writes when user logs out
	$effect(() => {
		if (browser && $user === null) {
			metadataOps.flush();
		}
	});

	const fetchLibrary = async (queryString: string, silent = false) => {
		try {
			if (!silent) isLoadingLibrary = true;
			libraryError = null;

			const response = await apiFetch(`/api/library${queryString}`);
			library = response.data as Series[];
			meta = response.meta;
		} catch (e) {
			libraryError = (e as Error).message;
		} finally {
			isLoadingLibrary = false;
		}
	};

	const toggleBookmark = async (e: Event, series: Series) => {
		e.preventDefault();
		e.stopPropagation();

		const oldState = series.bookmarked;
		series.bookmarked = !series.bookmarked;

		metadataOps.syncBookmark(series.id, series.bookmarked, () => {
			series.bookmarked = oldState;
		});
	};

	// --- Actions ---
	const handleOpenEdit = () => {
		const series = Array.from(uiState.selection.values())[0] as Series;
		if (series) {
			editModalTarget = series;
			isEditModalOpen = true;
		}
	};

	const handleCardClick = (e: MouseEvent, series: Series) => {
		if (uiState.isSelectionMode) {
			e.preventDefault();
			e.stopPropagation();
			uiState.toggleSelection(series as GlobalSeries);
		}
	};

	const handleRefresh = () => {
		const params = new URLSearchParams(page.url.searchParams);
		fetchLibrary(`?${params.toString()}`, true);
	};
</script>

<svelte:head>
	<title>{$user ? `${$user.username}'s Library` : 'Mokuro Library'}</title>
</svelte:head>

{#if $user === null}
	<!-- Auth View -->
	<div class="fixed inset-0 overflow-hidden">
		<!-- Background Image with responsive sizing -->
		<div
			class="absolute inset-0 bg-cover bg-center md:bg-[length:100%_100%] bg-no-repeat transition-all duration-700"
			style="background-image: url('{backgroundImage}');
			       background-size: cover;
			       background-position: center;"
		>
			<!-- Animated gradient overlay -->
			<div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-purple-900/30"></div>

			<!-- Floating manga-style elements -->
			{#each floatingElements as element (element.id)}
				<div
					class="floating-element absolute w-20 h-20 opacity-10"
					style="
						left: {element.x}%;
						top: {element.y}%;
						animation-delay: {element.delay}s;
						animation-duration: {element.duration}s;
					"
				>
					<div class="w-full h-full bg-white/5 backdrop-blur-sm rounded-lg rotate-12 border border-white/10"></div>
				</div>
			{/each}
		</div>

		<!-- Content Container -->
		<div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
			<!-- Login Card -->
			<div
				class="w-full max-w-md transform transition-all duration-700 ease-out"
				style="opacity: {showCard ? 1 : 0}; transform: translateY({showCard ? 0 : 20}px) scale({showCard ? 1 : 0.95});"
			>
				<!-- Decorative glow effect -->
				<div class="absolute -inset-1 bg-gradient-to-r from-accent/20 via-purple-500/20 to-accent/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity"></div>

				<!-- Card with glass effect -->
				<div class="relative bg-theme-surface/95 backdrop-blur-3xl rounded-3xl border-2 border-theme-border-light/30 shadow-2xl overflow-hidden">

					<!-- Animated top accent bar -->
					<div class="h-1.5 bg-gradient-to-r from-accent via-purple-500 to-accent animate-gradient-x"></div>

					<!-- Header Section with Logo -->
					<div class="px-8 pt-10 pb-8 text-center relative">
						<!-- Animated logo -->
						<div class="flex justify-center mb-6 animate-bounce-slow">
							<div class="relative">
								<!-- Glow effect behind logo -->
								<div class="absolute inset-0 bg-accent/30 blur-2xl rounded-full scale-150"></div>

								<!-- Logo -->
								<div class="relative h-20 w-20 bg-gradient-to-br from-accent to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-accent/40 ring-4 ring-accent/20 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="40"
										height="40"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="drop-shadow-lg"
									>
										<rect x="5" y="4" width="14" height="16" rx="2"></rect>
										<line x1="5" y1="9" x2="19" y2="9"></line>
										<line x1="5" y1="14" x2="19" y2="14"></line>
									</svg>
								</div>
							</div>
						</div>

						<!-- Animated Title -->
						<div class="relative h-20 overflow-hidden">
							<div
								class="absolute inset-0 transition-all duration-500 ease-out"
								style="opacity: {isRegisterMode ? 0 : 1}; transform: translateY({isRegisterMode ? -20 : 0}px);"
							>
								<h1 class="text-4xl font-black text-theme-primary mb-3 tracking-tight">
									<span class="bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent animate-gradient-x">
										Welcome Back!
									</span>
								</h1>
								<p class="text-base text-theme-secondary font-medium">
									Sign in to continue your manga journey
								</p>
							</div>
							<div
								class="absolute inset-0 transition-all duration-500 ease-out"
								style="opacity: {isRegisterMode ? 1 : 0}; transform: translateY({isRegisterMode ? 0 : 20}px);"
							>
								<h1 class="text-4xl font-black text-theme-primary mb-3 tracking-tight">
									<span class="bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent animate-gradient-x">
										Join the Library!
									</span>
								</h1>
								<p class="text-base text-theme-secondary font-medium">
									Create your account and start your manga adventure
								</p>
							</div>
						</div>

						<!-- Decorative manga speed lines -->
						<div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-5">
							<div class="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent transform -rotate-12"></div>
							<div class="absolute top-10 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent transform rotate-12"></div>
						</div>
					</div>

					<!-- Form Section -->
					<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="px-8 py-6 space-y-5">
						<!-- Username Input -->
						<div class="space-y-2.5 group">
							<label
								for="username"
								class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
									<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
									<circle cx="12" cy="7" r="4"></circle>
								</svg>
								Username
							</label>
							<input
								id="username"
								type="text"
								bind:value={username}
								required
								placeholder="Enter your username"
								class="w-full px-5 py-4 rounded-2xl bg-theme-main/50 border-2 border-theme-border
								       text-theme-primary placeholder-theme-tertiary text-base font-medium
								       focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
								       shadow-inner hover:border-theme-primary/30
								       transition-all duration-300 transform focus:scale-[1.02]"
							/>
						</div>

						<!-- Password Input -->
						<div class="space-y-2.5 group">
							<label
								for="password"
								class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
									<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
								</svg>
								Password
							</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								required
								placeholder={isRegisterMode ? "Min. 6 characters" : "Enter your password"}
								class="w-full px-5 py-4 rounded-2xl bg-theme-main/50 border-2 border-theme-border
								       text-theme-primary placeholder-theme-tertiary text-base font-medium
								       focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
								       shadow-inner hover:border-theme-primary/30
								       transition-all duration-300 transform focus:scale-[1.02]"
							/>
						</div>

						<!-- Confirm Password Input (only in register mode) -->
						{#if isRegisterMode}
							<div class="space-y-2.5 group animate-in fade-in slide-in-from-top-2 duration-300">
								<label
									for="confirmPassword"
									class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
										<path d="M9 11l3 3L22 4"></path>
										<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
									</svg>
									Confirm Password
								</label>
								<input
									id="confirmPassword"
									type="password"
									bind:value={confirmPassword}
									required
									placeholder="Re-enter your password"
									class="w-full px-5 py-4 rounded-2xl bg-theme-main/50 border-2 border-theme-border
									       text-theme-primary placeholder-theme-tertiary text-base font-medium
									       focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
									       shadow-inner hover:border-theme-primary/30
									       transition-all duration-300 transform focus:scale-[1.02]"
								/>
							</div>
						{/if}

						<!-- Error Message with shake animation -->
						{#if error}
							<div class="error-shake px-5 py-4 rounded-2xl bg-red-500/15 border-2 border-red-500/40 backdrop-blur-sm relative overflow-hidden">
								<!-- Animated error background -->
								<div class="absolute inset-0 bg-gradient-to-r from-red-500/5 via-red-500/10 to-red-500/5 animate-pulse"></div>

								<div class="relative flex items-center gap-3">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-400 flex-shrink-0">
										<circle cx="12" cy="12" r="10"></circle>
										<line x1="12" y1="8" x2="12" y2="12"></line>
										<line x1="12" y1="16" x2="12.01" y2="16"></line>
									</svg>
									<p class="text-sm text-red-300 font-semibold">{error}</p>
								</div>
							</div>
						{/if}

						<!-- Success Message -->
						{#if successMessage}
							<div class="px-5 py-4 rounded-2xl bg-green-500/15 border-2 border-green-500/40 backdrop-blur-sm relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
								<!-- Animated success background -->
								<div class="absolute inset-0 bg-gradient-to-r from-green-500/5 via-green-500/10 to-green-500/5 animate-pulse"></div>

								<div class="relative flex items-center gap-3">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-green-400 flex-shrink-0">
										<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
										<polyline points="22 4 12 14.01 9 11.01"></polyline>
									</svg>
									<p class="text-sm text-green-300 font-semibold">{successMessage}</p>
								</div>
							</div>
						{/if}

						<!-- Submit Button with enhanced effects -->
						<button
							type="submit"
							disabled={isLoading || successMessage !== null}
							class="group relative w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-accent to-purple-600 text-white text-base font-bold
							       shadow-2xl shadow-accent/30
							       disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale
							       transition-all duration-300 transform hover:scale-[1.02] active:scale-95
							       focus:outline-none focus:ring-4 focus:ring-accent/40 overflow-hidden"
						>
							<!-- Animated shimmer effect -->
							<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

							<span class="relative flex items-center justify-center gap-3">
								{#if isLoading}
									<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									{isRegisterMode ? 'Creating Account...' : 'Signing in...'}
								{:else if successMessage}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									Account Created!
								{:else if isRegisterMode}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover:scale-110 transition-transform">
										<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
										<circle cx="8.5" cy="7" r="4"></circle>
										<line x1="20" y1="8" x2="20" y2="14"></line>
										<line x1="23" y1="11" x2="17" y2="11"></line>
									</svg>
									Create Account
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover:translate-x-1 transition-transform">
										<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
										<polyline points="10 17 15 12 10 7"></polyline>
										<line x1="15" y1="12" x2="3" y2="12"></line>
									</svg>
									Sign In
								{/if}
							</span>
						</button>
					</form>

					<!-- Footer Section -->
					<div class="px-8 pb-8 pt-6 text-center border-t-2 border-theme-border-light/20">
						<p class="text-base text-theme-secondary">
							{isRegisterMode ? 'Already have an account?' : 'New to Mokuro Library?'}
							<button
								type="button"
								onclick={toggleMode}
								class="font-bold text-accent hover:text-accent-hover transition-all ml-2 inline-flex items-center gap-1 hover:gap-2 group"
							>
								{isRegisterMode ? 'Sign in' : 'Create an account'}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover:translate-x-0.5 transition-transform">
									<line x1="5" y1="12" x2="19" y2="12"></line>
									<polyline points="12 5 19 12 12 19"></polyline>
								</svg>
							</button>
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Library View -->
	<div
		class="flex flex-col min-h-[calc(100vh-5rem)] mx-auto px-4 sm:px-6 pt-1 sm:pt-2 pb-6"
		style="max-width: 1400px;"
	>
		{#if isLoadingLibrary && library.length === 0}
			<div class="flex-grow flex items-center justify-center">
				<div
					class="rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 flex items-center gap-4"
				>
					<svg
						class="animate-spin h-8 w-8 text-accent"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-theme-secondary">Loading library...</span>
				</div>
			</div>
		{:else if libraryError}
			<div class="flex-grow flex items-center justify-center p-4">
				<div
					class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-status-danger/20 text-status-danger shadow-[0_4px_16px_0_rgba(0,0,0,0.3)]"
				>
					Error loading library: {libraryError}
				</div>
			</div>
		{:else if library.length === 0}
			<div class="flex-grow flex flex-col items-center justify-center py-20 text-center">
				<div
					class="rounded-3xl backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 sm:p-12 max-w-md"
				>
					<div
						class="bg-theme-surface-hover backdrop-blur-2xl p-6 rounded-full mb-6 border border-white/5 inline-block"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-theme-tertiary"
						>
							<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
						</svg>
					</div>
					<p class="text-xl font-medium text-theme-primary mb-2">Your library is empty</p>
					<p class="text-theme-secondary max-w-sm mb-6">
						Upload some Mokuro-processed manga volumes to get started building your collection.
					</p>
					<button
						onclick={() => (uiState.isUploadOpen = true)}
						class="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors shadow-lg shadow-indigo-900/20"
					>
						Upload Now &rarr;
					</button>
				</div>
			</div>
		{:else}
			<div class="flex-grow pb-24 relative">
				<!-- Glassmorphic container wrapper with fade on background only -->
				<div class="relative p-3 sm:p-4">
					<!-- Background layer with fade mask - only fades the background, not content -->
					<div
						class="absolute inset-0 bg-black/20 backdrop-blur-3xl pointer-events-none z-0"
						style="mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); mask-composite: intersect; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); -webkit-mask-composite: source-in;"
					></div>

					<!-- Content layer (series cards) - fully visible, not affected by fade -->
					<div
						class="relative z-10 {uiState.viewMode === 'grid'
							? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
							: 'flex flex-col gap-3'}"
					>
						{#each library as series (series.id)}
							{@const { percent, isRead } = getSeriesProgress(series)}
							{@const isSelected = uiState.selection.has(series.id)}

							<LibraryEntry
								onLongPress={() => {
									uiState.enterSelectionMode(series as GlobalSeries);
								}}
								entry={{
									id: series.id,
									title: series.title,
									folderName: series.folderName,
									coverUrl: series.coverPath ? `/api/files/series/${series.id}/cover` : null
								}}
								type="series"
								viewMode={uiState.viewMode}
								{isSelected}
								isSelectionMode={uiState.isSelectionMode}
								progress={{
									percent: percent,
									isRead: isRead,
									showBar: percent > 0
								}}
								href={`/series/${series.id}`}
								mainStat={`${series.volumes.length} ${series.volumes.length === 1 ? 'Vol' : 'Vols'}`}
								subStat={formatLastReadDate(series.lastReadAt)}
								onSelect={(e) => handleCardClick(e, series)}
							>
								{#snippet circleAction()}
									<button
										onclick={(e) => toggleBookmark(e, series)}
										class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
											series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
										}`}
										title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											height="18"
											width="18"
											viewBox="0 0 24 24"
											fill={series.bookmarked ? 'currentColor' : 'none'}
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											class={`relative transition-all ${
												series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
											}`}
										>
											<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
										</svg>
									</button>
								{/snippet}

								{#snippet listActions()}
									<button
										onclick={(e) => toggleBookmark(e, series)}
										class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
											series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
										}`}
										title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											height="18"
											width="18"
											viewBox="0 0 24 24"
											fill={series.bookmarked ? 'currentColor' : 'none'}
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											class={`relative transition-all ${
												series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
											}`}
										>
											<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
										</svg>
									</button>
								{/snippet}
							</LibraryEntry>
						{/each}
					</div>
				</div>
			</div>

			<Footer {meta} />
			<LibraryActionBar type="series" onRefresh={handleRefresh} onRename={handleOpenEdit} />

			<EditSeriesModal
				series={editModalTarget}
				isOpen={isEditModalOpen}
				onClose={() => (isEditModalOpen = false)}
				onRefresh={handleRefresh}
			/>
		{/if}
	</div>
{/if}

<style>
	/* Responsive background sizing for mobile */
	@media (max-width: 767px) {
		.bg-cover {
			background-size: 150% auto;
			background-position: center center;
		}
	}

	/* Tablet and up - maintain aspect ratio */
	@media (min-width: 768px) and (max-width: 1023px) {
		.bg-cover {
			background-size: 120% auto;
			background-position: center center;
		}
	}

	/* Desktop - full coverage */
	@media (min-width: 1024px) {
		.bg-cover {
			background-size: cover;
			background-position: center center;
		}
	}

	/* Custom Animations */
	@keyframes gradient-x {
		0%, 100% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
	}

	@keyframes bounce-slow {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@keyframes float {
		0%, 100% {
			transform: translateY(0) rotate(12deg);
		}
		50% {
			transform: translateY(-30px) rotate(18deg);
		}
	}

	@keyframes error-shake {
		0%, 100% {
			transform: translateX(0);
		}
		10%, 30%, 50%, 70%, 90% {
			transform: translateX(-5px);
		}
		20%, 40%, 60%, 80% {
			transform: translateX(5px);
		}
	}

	.animate-gradient-x {
		background-size: 200% 200%;
		animation: gradient-x 3s ease infinite;
	}

	.animate-bounce-slow {
		animation: bounce-slow 3s ease-in-out infinite;
	}

	.floating-element {
		animation: float ease-in-out infinite;
	}

	.error-shake {
		animation: error-shake 0.5s ease-in-out;
	}

	/* Input focus glow effect */
	input:focus {
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.1),
			0 0 0 3px rgba(99, 102, 241, 0.1),
			0 0 20px rgba(99, 102, 241, 0.2);
	}

	/* Button hover glow */
	button:not(:disabled):hover {
		box-shadow:
			0 20px 40px -12px rgba(99, 102, 241, 0.5),
			0 0 30px rgba(99, 102, 241, 0.3);
	}

	/* Intensity Control: Change the % next to transparent to adjust glow strength */
	.neon-glow {
		transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
		filter: drop-shadow(0 0 1px color-mix(in srgb, var(--color-status-warning), transparent 30%))
			drop-shadow(0 0 3px color-mix(in srgb, var(--color-status-warning), transparent 50%))
			drop-shadow(0 0 6px color-mix(in srgb, var(--color-status-warning), transparent 70%));
	}

	.neon-off {
		transition: filter 0.8s ease-in;
		filter: drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%))
			drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%))
			drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%));
	}

	@keyframes bookmark-pop {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.4);
		}
		100% {
			transform: scale(1);
		}
	}

	.animate-pop {
		animation: bookmark-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}
</style>
