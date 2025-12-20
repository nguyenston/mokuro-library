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
		default: 'bg-theme-surface-hover/80 text-theme-primary',
		primary: 'bg-accent/40 text-accent border-2 border-accent/50',
		success: 'bg-status-success/35 text-status-success border-2 border-status-success/50',
		warning: 'bg-status-warning/35 text-status-warning border-2 border-status-warning/50',
		stats: 'bg-icon-stats/40 text-icon-stats border-2 border-icon-stats/50',
		appearance: 'bg-icon-appearance/40 text-icon-appearance border-2 border-icon-appearance/50'
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
	class="flex flex-col items-center justify-center p-3 rounded-xl bg-theme-surface-hover/50 hover:bg-theme-surface-hover/80 border-2 border-theme-border hover:border-theme-border transition-all group"
>
	<div class={`p-2.5 rounded-full mb-2 transition-transform group-hover:scale-110 shadow-lg ${usedStyle}`}>
		{@render icon()}
	</div>
	<span class="text-xs font-bold text-theme-primary">{label}</span>
</button>
