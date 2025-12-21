<script lang="ts">
	import { type Snippet } from 'svelte';
	import { contextMenu } from '$lib/contextMenuStore';

	let {
		label,
		icon,
		variant = 'default',
		onClick,
		className = '',
		keepOpen = false
	} = $props<{
		label: string;
		icon?: Snippet;
		// Added 'unread'
		variant?: 'default' | 'danger' | 'success' | 'primary' | 'unread';
		onClick: () => void;
		className?: string;
		keepOpen?: boolean;
	}>();

	const colors = {
		default: 'text-theme-primary hover:bg-theme-surface-hover/70 hover:text-white',
		primary: 'text-theme-primary hover:bg-theme-surface-hover/70 hover:text-accent',
		danger: 'text-status-danger hover:bg-status-danger/20',
		success: 'text-status-success hover:bg-status-success/20',
		unread: 'text-status-unread hover:bg-status-unread/20'
	};
	const usedColor = colors[variant as 'default' | 'danger' | 'success' | 'primary' | 'unread'];

	const iconBg = {
		default:
			'bg-theme-surface-hover/80 text-theme-primary group-hover:bg-theme-surface-hover group-hover:text-white shadow-md',
		primary: 'bg-accent/30 text-accent shadow-md shadow-accent/20',
		danger: 'bg-status-danger/30 text-status-danger shadow-md shadow-status-danger/20',
		success: 'bg-status-success/30 text-status-success shadow-md shadow-status-success/20',
		unread: 'bg-status-unread/30 text-status-unread shadow-md shadow-status-unread/20'
	};
	const usedIconBg = iconBg[variant as 'default' | 'danger' | 'success' | 'primary' | 'unread'];

	const handleClick = () => {
		onClick();
		if (!keepOpen) {
			contextMenu.close();
		}
	};
</script>

<button
	onclick={handleClick}
	class={`group w-full flex items-center justify-between px-2 py-2 rounded-xl text-sm font-bold mx-auto my-1 text-left text-sm gap-3 transition-colors rounded-xl ${usedColor} ${className}`}
>
	{#if icon}
		<div class={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${usedIconBg}`}>
			{@render icon()}
		</div>
	{/if}
	<span class="flex-grow truncate">{label}</span>
</button>
