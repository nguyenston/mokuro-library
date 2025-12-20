<script lang="ts">
	// This component displays reader settings
	// Since these are default values, we'll create a local state management
	// In a real implementation, you'd want to persist these to localStorage or backend

	type LayoutMode = 'single' | 'double' | 'vertical';
	type ReadingDirection = 'ltr' | 'rtl';
	type PageOffset = 'off' | 'odd' | 'even';
	type ZoomMode = 'fit-screen' | 'fit-width' | 'original' | 'keep' | 'keep-pan';

	// Default settings state
	let pageLayout = $state<LayoutMode>('double');
	let direction = $state<ReadingDirection>('rtl');
	let onPageZoom = $state<ZoomMode>('fit-screen');
	let autoFullscreen = $state(false);
	let hideHUD = $state(false);
	let showTextBoxBorders = $state(false);
	let showPageNumbers = $state(true);
	let showCharacterCount = $state(false);
	let showTimer = $state(false);
	let showNavZoneBorders = $state(false);
	let retainZoomLegacy = $state(false);
	let ocrOutline = $state(false);
	let coverOffset = $state<PageOffset>('odd');

	// Toggle functions
	const toggleSetting = (setting: string) => {
		switch (setting) {
			case 'autoFullscreen':
				autoFullscreen = !autoFullscreen;
				break;
			case 'hideHUD':
				hideHUD = !hideHUD;
				break;
			case 'showTextBoxBorders':
				showTextBoxBorders = !showTextBoxBorders;
				break;
			case 'showPageNumbers':
				showPageNumbers = !showPageNumbers;
				break;
			case 'showCharacterCount':
				showCharacterCount = !showCharacterCount;
				break;
			case 'showTimer':
				showTimer = !showTimer;
				break;
			case 'showNavZoneBorders':
				showNavZoneBorders = !showNavZoneBorders;
				break;
			case 'retainZoomLegacy':
				retainZoomLegacy = !retainZoomLegacy;
				break;
			case 'ocrOutline':
				ocrOutline = !ocrOutline;
				break;
		}
	};
</script>

<div class="w-full max-w-4xl p-10 rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-white mb-2">Reader Settings</h1>
		<p class="text-base text-gray-400">Configure how you read your content by default.</p>
	</div>

	<div class="space-y-5">
		<!-- Page Layout -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
					Page Layout
				</p>
				<span class="text-xs font-bold text-accent uppercase tracking-wider">
					{pageLayout === 'single' ? 'SINGLE' : pageLayout === 'double' ? 'DOUBLE' : 'VERTICAL'}
				</span>
			</div>
			<div class="grid grid-cols-3 gap-4">
				<button
					onclick={() => (pageLayout = 'single')}
					class="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 {pageLayout ===
					'single'
						? 'bg-accent/30 border-accent text-accent shadow-lg shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
					</svg>
					<span class="text-xs font-bold uppercase tracking-wider">Single</span>
				</button>

				<button
					onclick={() => (pageLayout = 'double')}
					class="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 {pageLayout ===
					'double'
						? 'bg-accent/30 border-accent text-accent shadow-lg shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="2" width="7" height="20" rx="1" ry="1" />
						<rect x="14" y="2" width="7" height="20" rx="1" ry="1" />
					</svg>
					<span class="text-xs font-bold uppercase tracking-wider">Double</span>
				</button>

				<button
					onclick={() => (pageLayout = 'vertical')}
					class="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 {pageLayout ===
					'vertical'
						? 'bg-accent/30 border-accent text-accent shadow-lg shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="6" y="2" width="12" height="6" rx="1" ry="1" />
						<rect x="6" y="9" width="12" height="6" rx="1" ry="1" />
						<rect x="6" y="16" width="12" height="6" rx="1" ry="1" />
					</svg>
					<span class="text-xs font-bold uppercase tracking-wider">Vertical</span>
				</button>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-5">
			<!-- Direction -->
			<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
				<div class="mb-4 flex items-center justify-between">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Direction</p>
					<span class="text-xs font-bold text-accent uppercase tracking-wider">
						{direction === 'ltr' ? 'LTR' : 'RTL'}
					</span>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<button
						onclick={() => (direction = 'ltr')}
						class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {direction ===
						'ltr'
							? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
							: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
					>
						Left to Right
					</button>
					<button
						onclick={() => (direction = 'rtl')}
						class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {direction ===
						'rtl'
							? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
							: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
					>
						Right to Left
					</button>
				</div>
			</div>

			<!-- Cover Offset -->
			<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
				<div class="mb-4 flex items-center justify-between">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
						Cover Offset
					</p>
					<span class="text-xs font-bold text-accent uppercase tracking-wider">
						{coverOffset === 'off' ? 'OFF' : coverOffset === 'odd' ? 'ODD' : 'EVEN'}
					</span>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<button
						onclick={() => (coverOffset = 'off')}
						class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {coverOffset ===
						'off'
							? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
							: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
					>
						Off
					</button>
					<button
						onclick={() => (coverOffset = 'odd')}
						class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {coverOffset ===
						'odd'
							? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
							: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
					>
						ODD
					</button>
					<button
						onclick={() => (coverOffset = 'even')}
						class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {coverOffset ===
						'even'
							? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
							: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
					>
						Even
					</button>
				</div>
			</div>
		</div>

		<!-- On Page Zoom -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
					On Page Zoom
				</p>
				<span class="text-xs font-bold text-accent uppercase tracking-wider">
					{onPageZoom === 'fit-screen' ? 'FIT SCREEN' : onPageZoom === 'fit-width' ? 'FIT WIDTH' : onPageZoom === 'original' ? 'ORIGINAL' : onPageZoom === 'keep' ? 'KEEP ZOOM' : 'KEEP ZOOM & PAN'}
				</span>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<button
					onclick={() => (onPageZoom = 'fit-screen')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {onPageZoom ===
					'fit-screen'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Fit to Screen
				</button>
				<button
					onclick={() => (onPageZoom = 'fit-width')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {onPageZoom ===
					'fit-width'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Fit to Width
				</button>
				<button
					onclick={() => (onPageZoom = 'original')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {onPageZoom ===
					'original'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Original Size
				</button>
			</div>
			<div class="grid grid-cols-2 gap-3 mt-3">
				<button
					onclick={() => (onPageZoom = 'keep')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {onPageZoom ===
					'keep'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Keep Zoom
				</button>
				<button
					onclick={() => (onPageZoom = 'keep-pan')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {onPageZoom ===
					'keep-pan'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Keep Zoom & Pan Top
				</button>
			</div>
		</div>

		<!-- Toggle Settings Grid -->
		<div class="grid grid-cols-2 gap-4">
			<!-- Auto fullscreen in reading mode -->
			<button
				onclick={() => toggleSetting('autoFullscreen')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Auto fullscreen in reading mode</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {autoFullscreen
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {autoFullscreen
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Hide HUD unless hovered -->
			<button
				onclick={() => toggleSetting('hideHUD')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Hide HUD unless hovered</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {hideHUD
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {hideHUD
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Show Text Box Borders -->
			<button
				onclick={() => toggleSetting('showTextBoxBorders')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Show Text Box Borders</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {showTextBoxBorders
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {showTextBoxBorders
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Show Page Numbers -->
			<button
				onclick={() => toggleSetting('showPageNumbers')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Show Page Numbers</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {showPageNumbers
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {showPageNumbers
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Show Character Count -->
			<button
				onclick={() => toggleSetting('showCharacterCount')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Show Character Count</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {showCharacterCount
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {showCharacterCount
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Show Timer -->
			<button
				onclick={() => toggleSetting('showTimer')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Show Timer</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {showTimer
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {showTimer
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Show Nav Zone Borders -->
			<button
				onclick={() => toggleSetting('showNavZoneBorders')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Show Nav Zone Borders</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {showNavZoneBorders
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {showNavZoneBorders
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- Retain Zoom (Legacy) -->
			<button
				onclick={() => toggleSetting('retainZoomLegacy')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">Retain Zoom (Legacy)</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {retainZoomLegacy
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {retainZoomLegacy
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>

			<!-- OCR Outline -->
			<button
				onclick={() => toggleSetting('ocrOutline')}
				class="rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
			>
				<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">OCR Outline</span>
				<div
					class="w-11 h-6 rounded-full transition-all duration-200 relative {ocrOutline
						? 'bg-accent/40 border-2 border-accent'
						: 'bg-black/40 border-2 border-white/10'}"
				>
					<div
						class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {ocrOutline
							? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
							: 'left-0.5 bg-gray-600'}"
					></div>
				</div>
			</button>
		</div>
	</div>
</div>
