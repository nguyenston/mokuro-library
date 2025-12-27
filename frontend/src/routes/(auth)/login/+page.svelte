<script lang="ts">
	import { apiFetch } from '$lib/api';
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import type { AuthUser } from '$lib/authStore';
	import backgroundImage from './background.png';
	import { onMount } from 'svelte';

	let isRegisterMode = false;
	let username = '';
	let password = '';
	let confirmPassword = '';
	let error: string | null = null;
	let successMessage: string | null = null;
	let isLoading = false;
	let showCard = false;
	let floatingElements: { id: number; delay: number; duration: number; x: number; y: number }[] =
		[];

	// Generate floating manga panels
	onMount(() => {
		showCard = true;
		// Create random floating elements for manga aesthetic
		floatingElements = Array.from({ length: 8 }, (_, i) => ({
			id: i,
			delay: Math.random() * 2,
			duration: 15 + Math.random() * 10,
			x: Math.random() * 100,
			y: Math.random() * 100
		}));
	});

	function toggleMode() {
		isRegisterMode = !isRegisterMode;
		// Reset form
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

			// Update the global store with the user data
			user.set(userData as AuthUser);

			// Redirect to the homepage
			await goto('/');
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

		// Add validation checks
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
			// Send only username and password to the API
			await apiFetch('/api/auth/register', {
				method: 'POST',
				body: { username, password }
			});

			// Show success and switch to login
			successMessage = 'Account created! Please sign in.';
			setTimeout(() => {
				isRegisterMode = false;
				password = '';
				confirmPassword = '';
				successMessage = null;
			}, 2000);
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
</script>

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
				<form on:submit|preventDefault={handleSubmit} class="px-8 py-6 space-y-5">
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
							on:click={toggleMode}
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
</style>
