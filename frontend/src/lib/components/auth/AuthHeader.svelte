<script lang="ts">
  let { isRegisterMode } = $props<{ isRegisterMode: boolean }>();
</script>

<div class="px-8 pt-10 pb-8 text-center relative">
  <div class="flex justify-center mb-6 animate-bounce-slow">
    <div class="relative">
      <div class="absolute inset-0 bg-accent/30 blur-2xl rounded-full scale-150"></div>

      <div
        class="relative h-20 w-20 bg-gradient-to-br from-accent to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-accent/40 ring-4 ring-accent/20 transform hover:scale-110 hover:rotate-6 transition-all duration-300"
      >
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

  <div class="relative h-20 overflow-hidden">
    <div
      class="absolute inset-0 transition-all duration-500 ease-out"
      style="opacity: {isRegisterMode ? 0 : 1}; transform: translateY({isRegisterMode
        ? -20
        : 0}px);"
    >
      <h1 class="text-4xl font-black text-theme-primary mb-3 tracking-tight">
        <span
          class="bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent animate-gradient-x"
        >
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
        <span
          class="bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent animate-gradient-x"
        >
          Join the Library!
        </span>
      </h1>
      <p class="text-base text-theme-secondary font-medium">
        Create your account and start your manga adventure
      </p>
    </div>
  </div>

  <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-5">
    <div
      class="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent transform -rotate-12"
    ></div>
    <div
      class="absolute top-10 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent transform rotate-12"
    ></div>
  </div>
</div>
