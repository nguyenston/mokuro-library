<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { apiFetch } from '$lib/services/api';
  import { user, type AuthUser } from '$lib/stores/authStore';
  import { apiCache } from '$lib/utils/caching/apiCache';
  import { getStoredFingerprint } from '$lib/services/deviceFingerprint';
  import AuthBackground from './AuthBackground.svelte';
  import AuthHeader from './AuthHeader.svelte';
  import AuthForm from './AuthForm.svelte';
  import AuthFooter from './AuthFooter.svelte';
  import { updateRefreshInterval } from '$lib/services/tokenRefresh';

  type RegisterMode = 'auto-login' | 'show-success';

  let {
    backgroundImage,
    initialMode = 'login',
    registerMode = 'auto-login',
    redirectOnAuth = false,
    registerRedirectTo,
    registerSuccessMessage,
    registerToggleHref
  } = $props<{
    backgroundImage: string;
    initialMode?: 'login' | 'register';
    registerMode?: RegisterMode;
    redirectOnAuth?: boolean;
    registerRedirectTo?: string;
    registerSuccessMessage?: string;
    registerToggleHref?: string;
  }>();

  let isRegisterMode = $state(initialMode === 'register');
  let username = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let rememberMe = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let isLoading = $state(false);
  let showCard = $state(false);
  let floatingElements = $state<
    { id: number; delay: number; duration: number; x: number; y: number }[]
  >([]);

  const buildFloatingElements = (count = 8) =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      delay: Math.random() * 2,
      duration: 15 + Math.random() * 10,
      x: Math.random() * 100,
      y: Math.random() * 100
    }));

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
      const deviceFingerprint = await getStoredFingerprint();

      const authUser = await apiFetch<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: { username, password, rememberMe, deviceFingerprint }
      });

      updateRefreshInterval(authUser.expiresIn);
      user.set(authUser);

      // Clear cache if user changed
      apiCache.setUserId(authUser.id);

      if (redirectOnAuth) {
        await goto(resolve('/', {}));
      }
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
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { username, password }
      });
      if (registerMode === 'auto-login') {
        const deviceFingerprint = await getStoredFingerprint();

        const userData = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { username, password, rememberMe, deviceFingerprint }
        });

        const authUser = userData as AuthUser;
        user.set(authUser);

        // Clear cache if user changed
        apiCache.setUserId(authUser.id);

        if (redirectOnAuth) {
          await goto(resolve('/', {}));
        }
      } else {
        successMessage = registerSuccessMessage ?? 'Account created! Please sign in.';
        setTimeout(() => {
          isRegisterMode = false;
          password = '';
          confirmPassword = '';
          successMessage = null;
          if (registerRedirectTo) {
            goto(resolve(String(registerRedirectTo), {}));
          }
        }, 2000);
      }
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

  onMount(() => {
    showCard = true;
    floatingElements = buildFloatingElements();
  });
</script>

<div class="auth-view fixed inset-0 overflow-hidden">
  <AuthBackground {backgroundImage} {floatingElements} />

  <!-- Content Container -->
  <div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
    <!-- Login Card -->
    <div
      class="w-full max-w-md transform transition-all duration-700 ease-out"
      style="opacity: {showCard ? 1 : 0}; transform: translateY({showCard
        ? 0
        : 20}px) scale({showCard ? 1 : 0.95});"
    >
      <!-- Decorative glow effect -->
      <div
        class="absolute -inset-1 bg-gradient-to-r from-accent/20 via-purple-500/20 to-accent/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity"
      ></div>

      <!-- Card with glass effect -->
      <div
        class="relative bg-theme-surface/95 backdrop-blur-3xl rounded-3xl border-2 border-theme-border-light/30 shadow-2xl overflow-hidden"
      >
        <!-- Animated top accent bar -->
        <div
          class="h-1.5 bg-gradient-to-r from-accent via-purple-500 to-accent animate-gradient-x"
        ></div>

        <AuthHeader {isRegisterMode} />

        <AuthForm
          bind:username
          bind:password
          bind:confirmPassword
          bind:rememberMe
          {isRegisterMode}
          {isLoading}
          {error}
          {successMessage}
          onSubmit={handleSubmit}
        />

        <AuthFooter {isRegisterMode} {registerToggleHref} onToggleMode={toggleMode} />
      </div>
    </div>
  </div>
</div>

<style>
  /* Responsive background sizing for mobile */
  @media (max-width: 767px) {
    :global(.auth-view .bg-cover) {
      background-size: 150% auto;
      background-position: center center;
    }
  }

  /* Tablet and up - maintain aspect ratio */
  @media (min-width: 768px) and (max-width: 1023px) {
    :global(.auth-view .bg-cover) {
      background-size: 120% auto;
      background-position: center center;
    }
  }

  /* Desktop - full coverage */
  @media (min-width: 1024px) {
    :global(.auth-view .bg-cover) {
      background-size: cover;
      background-position: center center;
    }
  }

  /* Custom Animations */
  @keyframes gradient-x {
    0%,
    100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }

  @keyframes bounce-slow {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0) rotate(12deg);
    }
    50% {
      transform: translateY(-30px) rotate(18deg);
    }
  }

  @keyframes error-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    10%,
    30%,
    50%,
    70%,
    90% {
      transform: translateX(-5px);
    }
    20%,
    40%,
    60%,
    80% {
      transform: translateX(5px);
    }
  }

  :global(.auth-view .animate-gradient-x) {
    background-size: 200% 200%;
    animation: gradient-x 3s ease infinite;
  }

  :global(.auth-view .animate-bounce-slow) {
    animation: bounce-slow 3s ease-in-out infinite;
  }

  :global(.auth-view .floating-element) {
    animation: float ease-in-out infinite;
  }

  :global(.auth-view .error-shake) {
    animation: error-shake 0.5s ease-in-out;
  }

  /* Input focus glow effect */
  :global(.auth-view input:focus) {
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 3px rgba(99, 102, 241, 0.1),
      0 0 20px rgba(99, 102, 241, 0.2);
  }

  /* Button hover glow */
  :global(.auth-view button:not(:disabled):hover) {
    box-shadow:
      0 20px 40px -12px rgba(99, 102, 241, 0.5),
      0 0 30px rgba(99, 102, 241, 0.3);
  }
</style>
