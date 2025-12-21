<script lang="ts">
	import { type Snippet } from 'svelte';

	let {
		label,
		icon,
		onClick,
		variant = 'default',
		active = false
	} = $props<{
		label: string;
		icon: Snippet;
		onClick: () => void;
		variant?: 'default' | 'primary' | 'success' | 'warning' | 'stats' | 'appearance';
		active?: boolean;
	}>();

	// Map variants to specific color styles for the icon circle
	const styles = {
		default: 'bg-theme-surface-hover/80 text-theme-primary',
		primary: 'bg-accent/20 text-accent border-2 border-accent/50',
		success: 'bg-status-success/20 text-status-success border-2 border-status-success/50',
		warning: 'bg-status-warning/20 text-status-warning border-2 border-status-warning/50',
		stats: 'bg-icon-stats/20 text-icon-stats border-2 border-icon-stats/50',
		appearance: 'bg-icon-appearance/40 text-icon-appearance border-2 border-icon-appearance/50'
	};

	const usedStyle =
		styles[variant as 'default' | 'primary' | 'success' | 'warning' | 'stats' | 'appearance'];
</script>

<button
	onclick={onClick}
	class={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group relative overflow-hidden ${
		active
			? 'bg-accent/10 border-accent'
			: 'bg-theme-surface-hover/50 hover:bg-theme-surface-hover/80 border-theme-border hover:border-theme-border-light'
	}`}
>
	<div
		class={`p-2.5 rounded-full mb-2 transition-transform group-hover:scale-110 shadow-lg ${
			active ? '!bg-accent !text-white !border-accent' : usedStyle
		}`}
	>
		{@render icon()}
	</div>
	<span class={`text-xs font-bold ${active ? 'text-accent' : 'text-theme-primary'}`}>
		{label}
	</span>
</button>
