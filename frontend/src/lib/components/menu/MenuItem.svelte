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
		default: 'text-theme-secondary hover:bg-theme-surface-hover hover:text-white',
		primary: 'text-theme-primary hover:bg-theme-surface-hover hover:text-accent',
		danger: 'text-status-danger hover:bg-status-danger/10',
		success: 'text-status-success hover:bg-status-success/10',
		unread: 'text-status-unread hover:bg-status-unread/10'
	};
	const usedColor = colors[variant as 'default' | 'danger' | 'success' | 'primary' | 'unread'];

	const iconBg = {
		default:
			'bg-theme-surface-hover/50 text-theme-secondary group-hover:bg-theme-surface-hover group-hover:text-white',
		primary: 'bg-accent/10 text-accent',
		danger: 'bg-status-danger/10 text-status-danger',
		success: 'bg-status-success/10 text-status-success',
		unread: 'bg-status-unread/10 text-status-unread'
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
	class={`group w-full px-5 py-2.5 text-left text-sm font-bold flex items-center gap-3 transition-colors ${usedColor} ${className}`}
>
	{#if icon}
		<div class={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${usedIconBg}`}>
			{@render icon()}
		</div>
	{/if}
	<span class="flex-grow truncate">{label}</span>
</button>
