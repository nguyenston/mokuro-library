<script lang="ts">
	import { apiFetch, apiUpload } from '$lib/api';
	import { fade, scale } from 'svelte/transition';
	import { createJobsFromFiles, type UploadJob } from '$lib/utils/uploadHelpers';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';

	let { isOpen, onClose, onUploadSuccess } = $props<{
		isOpen: boolean;
		onClose: () => void;
		onUploadSuccess: () => void;
	}>();

	// --- State ---
	let activeTab = $state<'upload' | 'guide'>('upload');
	let files = $state<FileList | null>(null);
	let jobs = $state<UploadJob[]>([]);
	let isProcessingQueue = $state(false);

	let totalJobs = $derived(jobs.length);
	let completedJobs = $derived(jobs.filter((j) => j.status === 'done').length);
	let hasJobs = $derived(jobs.length > 0);

	// --- Actions ---
	const resetState = () => {
		files = null;
		jobs = [];
		isProcessingQueue = false;
		activeTab = 'upload';
	};

	const handleClose = () => {
		onClose();
		setTimeout(resetState, 200);
	};

	$effect(() => {
		if (files) {
			createJobsFromFiles(files).then((newJobs) => {
				jobs = newJobs;
				processQueue();
			});
		}
	});

	// --- Pipeline Runner ---
	const processQueue = async () => {
		if (isProcessingQueue) return;
		isProcessingQueue = true;
		let hasUpdates = false;

		for (const job of jobs) {
			if (job.status === 'done') continue;
			try {
				const check = await apiFetch('/api/library/check', {
					method: 'POST',
					body: {
						series_folder_name: job.seriesFolderName,
						volume_folder_name: job.volumeFolderName
					}
				});

				if (check.exists) {
					job.status = 'done';
					job.progress = 100;
					job.resultMsg = 'Skipped (Duplicate)';
					continue;
				}

				job.status = 'uploading';
				const formData = new FormData();
				formData.append('series_folder_name', job.seriesFolderName);
				formData.append('volume_folder_name', job.volumeFolderName);

				if (job.metadata.seriesTitle || job.metadata.volumeTitle || job.metadata.volumeProgress) {
					formData.append(
						'metadata',
						JSON.stringify({
							series_title: job.metadata.seriesTitle,
							series_description: job.metadata.seriesDescription,
							volume_title: job.metadata.volumeTitle,
							volume_progress: job.metadata.volumeProgress
						})
					);
				}

				for (const file of job.files) {
					formData.append('files', file, file.webkitRelativePath);
				}

				await apiUpload('/api/library/upload', formData, (percent) => {
					job.progress = percent;
					if (percent === 100) job.status = 'processing';
				});

				job.status = 'done';
				job.resultMsg = `OK`;
				hasUpdates = true;
			} catch (e) {
				console.error(`Failed to upload ${job.name}`, e);
				job.status = 'error';
				job.resultMsg = (e as Error).message;
			}
		}

		isProcessingQueue = false;
		files = null;

		if (hasUpdates) {
			onUploadSuccess();
		}
	};
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
			transition:fade={{ duration: 150 }}
			onclick={handleClose}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && handleClose()}
			aria-label="Close modal"
		></div>

		<div
			class="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-black/40 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="flex items-center justify-between px-8 py-6 border-b border-white/5">
				<h2 class="text-2xl font-bold text-white">Import Volumes</h2>
				<button
					onclick={handleClose}
					class="p-2 -mr-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
					title="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="px-8 pt-6 pb-2">
				<MenuGridRadio
					bind:value={activeTab}
					options={[
						{ value: 'upload', label: 'Upload Files' },
						{ value: 'guide', label: 'Guide & Help' }
					]}
					layout={[2]}
					itemClass="flex items-center justify-center py-2"
				>
					{#snippet children(option, isSelected)}
						<span
							class="text-sm font-bold uppercase tracking-wider {isSelected
								? 'text-accent'
								: 'text-gray-400'}"
						>
							{option.label}
						</span>
					{/snippet}
				</MenuGridRadio>
			</div>

			<div class="flex-1 overflow-y-auto px-8 pb-8 pt-4">
				{#if activeTab === 'upload'}
					{#if !hasJobs}
						<div class="h-full flex flex-col justify-center">
							<label
								class="flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed border-white/10 bg-black/20 hover:bg-black/40 hover:border-accent/50 transition-all cursor-pointer group"
							>
								<div
									class="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-gray-400 group-hover:text-accent transition-colors"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="17 8 12 3 7 8" />
										<line x1="12" x2="12" y1="3" y2="15" />
									</svg>
								</div>
								<p class="text-lg font-medium text-gray-300 mb-1">Drag & Drop Folder</p>
								<p class="text-sm text-gray-500">or click to browse</p>
								<input type="file" class="hidden" webkitdirectory bind:files />
							</label>
						</div>
					{:else}
						<div class="space-y-4">
							<div class="flex justify-between items-end">
								<h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">
									Queue Status
								</h3>
								<span class="text-xs font-mono text-accent bg-accent/10 px-2 py-1 rounded">
									{completedJobs} / {totalJobs} Completed
								</span>
							</div>

							<div class="space-y-2">
								{#each jobs as job (job.id)}
									<div
										class="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center gap-4"
									>
										<div class="flex-shrink-0">
											{#if job.status === 'pending'}
												<div class="w-3 h-3 rounded-full bg-gray-600"></div>
											{:else if job.status === 'uploading' || job.status === 'processing'}
												<div
													class="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin"
												></div>
											{:else if job.status === 'done'}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="text-green-500"
												>
													<polyline points="20 6 9 17 4 12" />
												</svg>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="text-red-500"
												>
													<line x1="18" y1="6" x2="6" y2="18" />
													<line x1="6" y1="6" x2="18" y2="18" />
												</svg>
											{/if}
										</div>

										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between mb-1 gap-3">
												<span
													class="text-sm font-medium text-white truncate min-w-0 flex-1"
													title={job.name}>{job.name}</span
												>
												<span
													class="text-xs font-bold text-gray-500 uppercase whitespace-nowrap flex-shrink-0"
												>
													{job.status === 'done'
														? job.resultMsg === 'OK'
															? 'Done'
															: job.resultMsg
														: job.status}
												</span>
											</div>
											{#if job.status === 'uploading'}
												<div class="h-1 w-full bg-white/10 rounded-full overflow-hidden">
													<div
														class="h-full bg-accent transition-all duration-300"
														style="width: {job.progress}%"
													></div>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>

							<div class="flex justify-end pt-4">
								{#if !isProcessingQueue}
									<button
										onclick={handleClose}
										class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
									>
										Done
									</button>
								{:else}
									<span class="text-sm text-gray-500 animate-pulse">Processing...</span>
								{/if}
							</div>
						</div>
					{/if}
				{:else}
					<div class="space-y-6 text-gray-300">
						<section class="space-y-3">
							<h3 class="text-lg font-bold text-white flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-accent"
									><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
										points="17 8 12 3 7 8"
									/><line x1="12" x2="12" y1="3" y2="15" /></svg
								>
								Directory Upload
							</h3>
							<p class="text-sm leading-relaxed">
								Mokuro Library allows you to upload entire folders at once. The system will parse
								your folder structure to automatically identify Series and Volumes.
							</p>
							<div
								class="bg-black/30 rounded-xl p-4 border border-white/5 font-mono text-xs text-gray-400"
							>
								<div class="text-accent mb-2 font-bold">// Recommended Structure</div>
								<div>
									My Manga Uploads/ <span class="text-gray-600">&lt;-- Point upload here</span>
								</div>

								<div class="pl-4">
									├── Yotsuba&!/ <span class="text-gray-600">&lt;-- Series Title</span>
								</div>
								<div class="pl-8">
									├── Volume 1/ <span class="text-gray-600">&lt;-- Volume Title</span>
								</div>
								<div class="pl-12 text-gray-500">├── 001.jpg</div>
								<div class="pl-12 text-gray-500">└── ...</div>

								<div class="pl-8">├── Volume 2/</div>
								<div class="pl-12 text-gray-500">├── 001.jpg</div>
								<div class="pl-12 text-gray-500">└── ...</div>

								<div class="pl-8 text-green-400">
									├── Volume 1.mokuro <span class="text-gray-600">&lt;-- Data File</span>
								</div>
								<div class="pl-8 text-green-400">├── Volume 2.mokuro</div>
								<div class="pl-8 text-blue-400">
									└── Yotsuba&!.png <span class="text-gray-600">&lt;-- Series Cover</span>
								</div>

								<div class="h-2"></div>

								<div class="pl-4">└── Another Series/</div>
								<div class="pl-8">├── Chapter 1/</div>
								<div class="pl-12 text-gray-500">├── 01.png</div>
								<div class="pl-12 text-gray-500">└── ...</div>
								<div class="pl-8 text-green-400">├── Chapter 1.mokuro</div>
								<div class="pl-4 text-blue-400">└── Another Series.png</div>
							</div>
						</section>

						<section class="space-y-3">
							<h3 class="text-lg font-bold text-white flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-accent"
									><path
										d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
									/><polyline points="14 2 14 8 20 8" /></svg
								>
								Mokuro Files
							</h3>
							<p class="text-sm leading-relaxed">
								To enable OCR features, you need to generate <code>.mokuro</code> files using the Mokuro
								tool. Place these files alongside your image folders (not inside them).
							</p>
							<a
								href="https://github.com/kha-white/mokuro"
								target="_blank"
								class="inline-flex items-center gap-2 text-sm text-accent hover:text-white transition-colors"
							>
								View Mokuro on GitHub &rarr;
							</a>
						</section>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
