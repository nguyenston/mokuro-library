<script lang="ts">
	import { type Snippet } from 'svelte';
	import { contextMenu } from '$lib/contextMenuStore';

	let {
		label,
		icon,
		onClick,
		variant = 'default'
	} = $props<{
		label: string;
		icon: Snippet;
		onClick: () => void;
		variant?: 'default' | 'primary' | 'success' | 'warning' | 'stats' | 'appearance';
	}>();

	// Map variants to specific color styles for the icon circle
	const styles = {
		default: 'bg-theme-surface-hover text-theme-secondary',
		primary: 'bg-accent/10 text-accent',
		success: 'bg-status-success/10 text-status-success',
		warning: 'bg-status-warning/10 text-status-warning',
		stats: 'bg-icon-stats/10 text-icon-stats',
		appearance: 'bg-icon-appearance/10 text-icon-appearance'
	};
	const usedStyle =
		styles[variant as 'default' | 'primary' | 'success' | 'warning' | 'stats' | 'appearance'];

	const handleClick = () => {
		onClick();
		// We don't auto-close here because some grid items (like Download) might toggle a submenu
	};
</script>

<button
	onclick={handleClick}
	class="flex flex-col items-center justify-center p-3 rounded-xl bg-theme-surface-hover/30 hover:bg-theme-surface-hover border border-transparent hover:border-theme-border-light transition-all group"
>
	<div class={`p-2.5 rounded-full mb-2 transition-transform group-hover:scale-110 ${usedStyle}`}>
		{@render icon()}
	</div>
	<span class="text-xs font-bold text-theme-primary">{label}</span>
</button>
