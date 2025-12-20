<script lang="ts">
	// This component displays Anki Connect settings
	// Since these are default values, we'll create a local state management
	// In a real implementation, you'd want to persist these to localStorage or backend

	type TriggerMethod = 'both' | 'double-click' | 'right-click';

	// Default settings state
	let ankiConnectEnabled = $state(false);
	let pictureField = $state('Picture');
	let sentenceField = $state('Sentence');
	let cropImage = $state(false);
	let overwriteImage = $state(true);
	let grabSentence = $state(false);
	let triggerMethod = $state<TriggerMethod>('both');
	let maxHeight = $state(0);
	let maxWidth = $state(0);
	let quality = $state(0.5);

	// Toggle functions
	const toggleSetting = (setting: string) => {
		switch (setting) {
			case 'ankiConnectEnabled':
				ankiConnectEnabled = !ankiConnectEnabled;
				break;
			case 'cropImage':
				cropImage = !cropImage;
				break;
			case 'overwriteImage':
				overwriteImage = !overwriteImage;
				break;
			case 'grabSentence':
				grabSentence = !grabSentence;
				break;
		}
	};
</script>

<div class="w-full max-w-4xl p-10 rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-white mb-2">Anki Connect</h1>
			<p class="text-base text-gray-400">WIP docs coming soon</p>
		</div>
		<button
			class="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 backdrop-blur-2xl border border-white/5 text-gray-400 hover:text-white hover:bg-black/40 transition-all duration-200"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
			</svg>
			<span class="font-semibold text-sm">Docs</span>
		</button>
	</div>

	<div class="space-y-5">
		<!-- AnkiConnect Integration Status -->
		<button
			onclick={() => toggleSetting('ankiConnectEnabled')}
			class="w-full rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
		>
			<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors"
				>AnkiConnect Integration Enabled</span
			>
			<div
				class="w-11 h-6 rounded-full transition-all duration-200 relative {ankiConnectEnabled
					? 'bg-accent/40 border-2 border-accent'
					: 'bg-black/40 border-2 border-white/10'}"
			>
				<div
					class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {ankiConnectEnabled
						? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
						: 'left-0.5 bg-gray-600'}"
				></div>
			</div>
		</button>

		<!-- Field Settings -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Field Settings</p>
			</div>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-semibold text-gray-400 mb-2">Picture field:</label>
					<input
						type="text"
						bind:value={pictureField}
						placeholder="Picture"
						class="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
					/>
				</div>
				<div>
					<label class="block text-sm font-semibold text-gray-400 mb-2">Sentence field:</label>
					<input
						type="text"
						bind:value={sentenceField}
						placeholder="Sentence"
						class="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
					/>
				</div>
			</div>
		</div>

		<!-- Image/Sentence Actions -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]"
					>Image/Sentence Actions</p
				>
			</div>
			<div class="space-y-3">
				<button
					onclick={() => toggleSetting('cropImage')}
					class="w-full rounded-xl bg-black/20 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/30 transition-all duration-200 group"
				>
					<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors"
						>Crop image</span
					>
					<div
						class="w-11 h-6 rounded-full transition-all duration-200 relative {cropImage
							? 'bg-accent/40 border-2 border-accent'
							: 'bg-black/40 border-2 border-white/10'}"
					>
						<div
							class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {cropImage
								? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
								: 'left-0.5 bg-gray-600'}"
						></div>
					</div>
				</button>

				<button
					onclick={() => toggleSetting('overwriteImage')}
					class="w-full rounded-xl bg-black/20 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/30 transition-all duration-200 group"
				>
					<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors"
						>Overwrite image</span
					>
					<div
						class="w-11 h-6 rounded-full transition-all duration-200 relative {overwriteImage
							? 'bg-accent/40 border-2 border-accent'
							: 'bg-black/40 border-2 border-white/10'}"
					>
						<div
							class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {overwriteImage
								? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
								: 'left-0.5 bg-gray-600'}"
						></div>
					</div>
				</button>

				<button
					onclick={() => toggleSetting('grabSentence')}
					class="w-full rounded-xl bg-black/20 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/30 transition-all duration-200 group"
				>
					<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors"
						>Grab sentence</span
					>
					<div
						class="w-11 h-6 rounded-full transition-all duration-200 relative {grabSentence
							? 'bg-accent/40 border-2 border-accent'
							: 'bg-black/40 border-2 border-white/10'}"
					>
						<div
							class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {grabSentence
								? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
								: 'left-0.5 bg-gray-600'}"
						></div>
					</div>
				</button>
			</div>
		</div>

		<!-- Trigger method -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Trigger method:</p>
				<span class="text-xs font-bold text-accent uppercase tracking-wider">
					{triggerMethod === 'both'
						? 'BOTH'
						: triggerMethod === 'double-click'
							? 'DOUBLE CLICK'
							: 'RIGHT CLICK'}
				</span>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<button
					onclick={() => (triggerMethod = 'both')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {triggerMethod ===
					'both'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Both
				</button>
				<button
					onclick={() => (triggerMethod = 'double-click')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {triggerMethod ===
					'double-click'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Double Click
				</button>
				<button
					onclick={() => (triggerMethod = 'right-click')}
					class="py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2 {triggerMethod ===
					'right-click'
						? 'bg-accent/30 border-accent text-accent shadow-md shadow-accent/50'
						: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
				>
					Right Click
				</button>
			</div>
		</div>

		<!-- Quality Settings -->
		<div class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg">
			<div class="mb-4">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">Quality Settings</p>
				<p class="text-xs text-gray-400">
					Allows you to customize the file size stored on your devices.
				</p>
			</div>
			<div class="space-y-4">
				<!-- Max Height -->
				<div>
					<label class="block text-sm font-semibold text-gray-400 mb-2"
						>Max Height (0 = Ignore; 200 Recommended):</label
					>
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={maxHeight}
							min="0"
							class="flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
						/>
						<button
							onclick={() => maxHeight = Math.max(0, maxHeight - 1)}
							class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="18 15 12 9 6 15" />
							</svg>
						</button>
						<button
							onclick={() => maxHeight = maxHeight + 1}
							class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</button>
					</div>
				</div>

				<!-- Max Width -->
				<div>
					<label class="block text-sm font-semibold text-gray-400 mb-2"
						>Max Width (0 = Ignore; 200 Recommended):</label
					>
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={maxWidth}
							min="0"
							class="flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
						/>
						<button
							onclick={() => maxWidth = Math.max(0, maxWidth - 1)}
							class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="18 15 12 9 6 15" />
							</svg>
						</button>
						<button
							onclick={() => maxWidth = maxWidth + 1}
							class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</button>
					</div>
				</div>

				<!-- Quality Slider -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-semibold text-gray-400"
							>Quality (Between 0 and 1; 0.5 Recommended):</label
						>
						<span class="text-xs font-semibold text-accent">{quality.toFixed(1)} (0-1)</span>
					</div>
					<div class="relative">
						<input
							type="range"
							bind:value={quality}
							min="0"
							max="1"
							step="0.1"
							class="w-full h-2 rounded-full appearance-none cursor-pointer slider"
							style="--quality: {quality}"
						/>
						<style>
							.slider {
								background: linear-gradient(to right, rgb(var(--accent)) 0%, rgb(var(--accent)) calc(var(--quality) * 100%), rgba(255, 255, 255, 0.1) calc(var(--quality) * 100%), rgba(255, 255, 255, 0.1) 100%);
							}
							.slider::-webkit-slider-thumb {
								appearance: none;
								width: 18px;
								height: 18px;
								border-radius: 50%;
								background: rgb(var(--accent));
								cursor: pointer;
								box-shadow: 0 0 8px rgba(var(--accent), 0.5);
							}
							.slider::-moz-range-thumb {
								width: 18px;
								height: 18px;
								border-radius: 50%;
								background: rgb(var(--accent));
								cursor: pointer;
								border: none;
								box-shadow: 0 0 8px rgba(var(--accent), 0.5);
							}
						</style>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

