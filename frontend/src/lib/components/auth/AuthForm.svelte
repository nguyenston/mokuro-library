<script lang="ts">
  let {
    username = $bindable(),
    password = $bindable(),
    confirmPassword = $bindable(),
    rememberMe = $bindable(),
    isRegisterMode,
    isLoading,
    error,
    successMessage,
    onSubmit
  } = $props<{
    username: string;
    password: string;
    confirmPassword: string;
    rememberMe: boolean;
    isRegisterMode: boolean;
    isLoading: boolean;
    error: string | null;
    successMessage: string | null;
    onSubmit: () => void;
  }>();
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    onSubmit();
  }}
  class="px-8 py-6 space-y-5"
>
  <div class="space-y-2.5 group">
    <label
      for="username"
      class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-accent"
      >
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

  <div class="space-y-2.5 group">
    <label
      for="password"
      class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-accent"
      >
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
      placeholder={isRegisterMode ? 'Min. 6 characters' : 'Enter your password'}
      class="w-full px-5 py-4 rounded-2xl bg-theme-main/50 border-2 border-theme-border
			       text-theme-primary placeholder-theme-tertiary text-base font-medium
			       focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30
			       shadow-inner hover:border-theme-primary/30
			       transition-all duration-300 transform focus:scale-[1.02]"
    />
  </div>

  {#if !isRegisterMode}
    <div class="flex items-center gap-3 px-1 py-1">
      <input
        id="rememberMe"
        type="checkbox"
        bind:checked={rememberMe}
        class="w-5 h-5 rounded-md border-2 border-theme-border bg-theme-main/50
				       text-accent focus:ring-2 focus:ring-accent/30 focus:outline-none
				       cursor-pointer transition-all duration-200
				       checked:bg-accent checked:border-accent"
      />
      <label
        for="rememberMe"
        class="text-sm text-theme-secondary font-medium cursor-pointer select-none
				       hover:text-theme-primary transition-colors duration-200"
      >
        Remember me for 30 days
      </label>
    </div>
  {/if}

  {#if isRegisterMode}
    <div class="space-y-2.5 group animate-in fade-in slide-in-from-top-2 duration-300">
      <label
        for="confirmPassword"
        class="block text-xs font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-accent"
        >
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

  {#if error}
    <div
      class="error-shake px-5 py-4 rounded-2xl bg-red-500/15 border-2 border-red-500/40 backdrop-blur-sm relative overflow-hidden"
    >
      <div
        class="absolute inset-0 bg-gradient-to-r from-red-500/5 via-red-500/10 to-red-500/5 animate-pulse"
      ></div>

      <div class="relative flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-red-400 flex-shrink-0"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p class="text-sm text-red-300 font-semibold">{error}</p>
      </div>
    </div>
  {/if}

  {#if successMessage}
    <div
      class="px-5 py-4 rounded-2xl bg-green-500/15 border-2 border-green-500/40 backdrop-blur-sm relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div
        class="absolute inset-0 bg-gradient-to-r from-green-500/5 via-green-500/10 to-green-500/5 animate-pulse"
      ></div>

      <div class="relative flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-green-400 flex-shrink-0"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <p class="text-sm text-green-300 font-semibold">{successMessage}</p>
      </div>
    </div>
  {/if}

  <button
    type="submit"
    disabled={isLoading || successMessage !== null}
    class="group relative w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-accent to-purple-600 text-white text-base font-bold
		       shadow-2xl shadow-accent/30
		       disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale
		       transition-all duration-300 transform hover:scale-[1.02] active:scale-95
		       focus:outline-none focus:ring-4 focus:ring-accent/40 overflow-hidden"
  >
    <div
      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
    ></div>

    <span class="relative flex items-center justify-center gap-3">
      {#if isLoading}
        <svg
          class="animate-spin h-5 w-5"
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
        {isRegisterMode ? 'Creating Account...' : 'Signing in...'}
      {:else if successMessage}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Account Created!
      {:else if isRegisterMode}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transform group-hover:scale-110 transition-transform"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        Create Account
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transform group-hover:translate-x-1 transition-transform"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        Sign In
      {/if}
    </span>
  </button>
</form>
