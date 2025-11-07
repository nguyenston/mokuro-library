<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
	<div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
		{@render children()}
	</div>
</div>
