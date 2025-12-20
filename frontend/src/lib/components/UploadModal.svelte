<script lang="ts">
	import { apiFetch, apiUpload } from '$lib/api';
	import { fade } from 'svelte/transition';

	let { isOpen, onClose, onUploadSuccess } = $props<{
		isOpen: boolean;
		onClose: () => void;
		onUploadSuccess: () => void;
	}>();

	// --- Types ---

	type UploadJob = {
		id: string;
		name: string;
		files: File[];
		status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
		progress: number;
		resultMsg?: string;
		seriesFolderName: string;
		volumeFolderName: string;
		metadata: {
			seriesTitle?: string | null;
			seriesDescription?: string | null;
			volumeTitle?: string | null;
			volumeProgress?: { page: number; completed: boolean } | null;
		};
	};

	type DirNode = {
		name: string;
		fullPath: string;
		files: File[];
		children: Map<string, DirNode>;
	};

	type SeriesMetadata = {
		series: {
			title: string | null;
			description?: string | null;
		};
		volumes: Record<
			string,
			{
				displayTitle: string | null;
				progress?: { page: number; completed: boolean } | null;
			}
		>;
	};

	// --- State ---

	let files = $state<FileList | null>(null);
	let jobs = $state<UploadJob[]>([]);
	let isProcessingQueue = $state(false);
	let isUploadingMangaExpanded = $state(false);
	let isMokuroToolExpanded = $state(false);

	let totalJobs = $derived(jobs.length);
	let completedJobs = $derived(jobs.filter((j) => j.status === 'done').length);

	// --- Actions ---

	const resetState = () => {
		files = null;
		jobs = [];
		isProcessingQueue = false;
	};

	const handleClose = () => {
		onClose();
	};

	$effect(() => {
		if (files) createJobsFromFiles(files);
	});

	// --- 1. TREE BUILDER & JOB CREATOR ---

	const createJobsFromFiles = async (fileList: FileList) => {
		const rootChildren = new Map<string, DirNode>();

		// Step A: Build the Directory Tree
		for (const file of fileList) {
			// FILTER 1: Ignore junk files immediately (DS_Store, Thumbs.db, txt, etc.)
			// We allow .json because we need to read it for metadata, even if we don't upload it.
			if (!/\.(jpg|jpeg|png|webp|mokuro|json)$/i.test(file.name)) {
				continue;
			}

			// FILTER 2: Ignore Hidden Files & System Folders
			// We check every segment of the path (folders and filename)
			const pathParts = file.webkitRelativePath.split('/');

			const isJunk = pathParts.some(
				(part) =>
					part.startsWith('.') || // Hidden files/folders (.git, ._image.jpg)
					[
						'__MACOSX',
						'node_modules',
						'$RECYCLE.BIN',
						'System Volume Information',
						'Thumbs.db',
						'_ocr'
					].includes(part)
			);

			if (isJunk) continue;

			// this is the key for clustering (i.e. determine if files belong to the same volume)
			const folderParts = file.webkitRelativePath.split('/').slice(0, -1);

			// if file is mokuro, put it in the same cluster as ${seriesFolderName}/${volumeFolderName}
			if (file.name.toLowerCase().endsWith('.mokuro')) {
				folderParts.push(file.name.replace(/\.mokuro$/i, ''));
			}
			if (folderParts.length > 3) continue; // file tree should not be deeper than 3 (root/series/volume)

			let currentMap = rootChildren;
			let currentPath = '';
			let node: DirNode | undefined;

			for (const part of folderParts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part;

				if (!currentMap.has(part)) {
					currentMap.set(part, {
						name: part,
						fullPath: currentPath,
						files: [],
						children: new Map()
					});
				}

				node = currentMap.get(part)!;
				currentMap = node.children;
			}

			if (node) node.files.push(file);
		}

		// Step B: Traverse Tree
		const newJobs: UploadJob[] = [];

		const traverse = async (
			map: Map<string, DirNode>,
			parentName: string | null,
			parentMetadata?: SeriesMetadata
		) => {
			const sortedKeys = Array.from(map.keys()).sort((a, b) =>
				a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
			);

			for (const key of sortedKeys) {
				const node = map.get(key)!;
				let currentMetadata = parentMetadata;

				// metadata json file if json file name is the same as parent directory
				const jsonFile = node.files.find((f) => f.name === `${node.name}.json`);
				if (jsonFile) {
					try {
						const text = await jsonFile.text();
						currentMetadata = JSON.parse(text) as SeriesMetadata;
					} catch (e) {
						console.warn(`Failed to parse metadata for ${node.fullPath}`, e);
					}
				}

				// Merge Parent Covers
				if (node.files.length > 0 && node.children.size > 0) {
					const validCovers = node.files.filter((f) => {
						const fName = f.name.substring(0, f.name.lastIndexOf('.'));
						return fName === node.name && /\.(jpg|jpeg|png|webp)$/i.test(f.name);
					});

					if (validCovers.length > 0) {
						const firstChildKey = Array.from(node.children.keys()).sort((a, b) =>
							a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
						)[0];

						if (firstChildKey) {
							const child = node.children.get(firstChildKey)!;
							child.files.push(...validCovers);
							node.files = node.files.filter((f) => !validCovers.includes(f));
						}
					}
				}

				// CREATE JOB
				if (node.files.length > 0) {
					// FILTER 3: Exclude JSON files from the actual upload payload
					// We have already extracted their data into 'currentMetadata'.
					// Uploading them wastes bandwidth and triggers backend cleanup logic.
					const payloadFiles = node.files.filter((f) => !f.name.toLowerCase().endsWith('.json'));

					// Only create a job if there are actual files left (images or mokuro)
					if (payloadFiles.length > 0) {
						const seriesFolder = parentName ?? node.name;
						const volumeFolder = node.name;

						const displayName =
							seriesFolder === volumeFolder ? seriesFolder : `${seriesFolder}/${volumeFolder}`;

						// Extract Data
						const seriesTitle = currentMetadata?.series?.title ?? null;
						const seriesDescription = currentMetadata?.series?.description ?? null;
						const volMeta = currentMetadata?.volumes?.[node.name];
						const volumeTitle = volMeta?.displayTitle ?? null;
						const volumeProgress = volMeta?.progress ?? null;

						newJobs.push({
							id: `vol-${node.fullPath}`,
							name: displayName,
							files: payloadFiles,
							status: 'pending',
							progress: 0,
							seriesFolderName: seriesFolder,
							volumeFolderName: volumeFolder,
							metadata: { seriesTitle, seriesDescription, volumeTitle, volumeProgress }
						});
					}
				}

				await traverse(node.children, node.name, currentMetadata);
			}
		};

		await traverse(rootChildren, null);

		jobs = newJobs;
		processQueue();
	};

	// --- 2. PIPELINE RUNNER ---

	const processQueue = async () => {
		if (isProcessingQueue) return;
		isProcessingQueue = true;

		for (const job of jobs) {
			if (job.status === 'done') continue;

			try {
				// --- STEP 1: PRE-FLIGHT CHECK ---
				// Ask server if this volume exists before sending heavy files.
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
					// Don't trigger onUploadSuccess() for skips to avoid unnecessary refreshes
					continue;
				}

				// --- STEP 2: UPLOAD (Only if new) ---
				job.status = 'uploading';

				const formData = new FormData();

				// Append fields and files

				// Metadata FIRST
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

				// Files SECOND
				for (const file of job.files) {
					formData.append('files', file, file.webkitRelativePath);
				}

				await apiUpload('/api/library/upload', formData, (percent) => {
					job.progress = percent;
					if (percent === 100) job.status = 'processing';
				});

				job.status = 'done';
				job.resultMsg = `OK`;
				onUploadSuccess();
			} catch (e) {
				console.error(`Failed to upload ${job.name}`, e);
				job.status = 'error';
				job.resultMsg = (e as Error).message;
			}
		}

		isProcessingQueue = false;
		files = null;
	};
</script>

{#if isOpen}
	<button
		transition:fade={{ duration: 150 }}
		onclick={handleClose}
		type="button"
		class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
		aria-label="button"
	></button>

	<div
		transition:fade={{ duration: 150 }}
		class="fixed top-1/2 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-theme-surface border border-theme-border shadow-2xl overflow-hidden"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border">
			<div class="flex items-center gap-3">
				<h2 class="text-xl font-bold text-theme-primary">Import</h2>
				<button
					onclick={() => window.open('https://nguyenston.github.io/mokuro-library/managing-your-library.html', '_blank')}
					class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-theme-surface border border-theme-border-light text-theme-secondary hover:text-white hover:border-theme-primary/50 transition-all text-sm"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
					</svg>
					Docs
				</button>
			</div>
			<button
				onclick={handleClose}
				class="text-theme-secondary hover:text-white transition-colors"
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

		{#if jobs.length === 0}
			<!-- Collapsible Sections -->
			<div class="p-6 space-y-3">
				<!-- Uploading Manga Section -->
				<div class="rounded-xl bg-theme-main border border-theme-border-light overflow-hidden">
					<button
						onclick={() => (isUploadingMangaExpanded = !isUploadingMangaExpanded)}
						class="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-theme-surface-hover transition-colors"
					>
						<span class="font-semibold text-theme-primary">Uploading Manga</span>
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
							class="text-theme-secondary transition-transform {isUploadingMangaExpanded
								? 'rotate-180'
								: ''}"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>

					{#if isUploadingMangaExpanded}
						<div class="px-5 pb-4 space-y-3 text-sm text-theme-secondary">
							<p>
								Mokuro Library is designed to upload entire Mokuro-processed directories at once.
							</p>
							<ul class="list-disc list-inside space-y-1.5 pl-2">
								<li>From the main library page, click the Upload button to open the upload modal.</li>
								<li>
									The application uses a Directory Upload method. You must select the root folder
									that contains your processed manga.
								</li>
								<li>The server will parse the folder structure to identify series and volumes.</li>
							</ul>

							<div class="mt-4">
								<p class="font-semibold text-theme-primary mb-2">Required Folder Structure</p>
								<pre
									class="bg-theme-surface/50 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-theme-border/50 text-theme-secondary"
								><code>My Manga Uploads/               <span class="text-theme-tertiary">&lt;-- You can point the upload modal here</span>
├── Yotsuba&!/                  <span class="text-theme-tertiary">&lt;-- or here (Series title)</span>
│   ├── Volume 1/               <span class="text-theme-tertiary">&lt;-- volume_title (image folder)</span>
│   │   ├── 001.jpg             <span class="text-theme-tertiary">&lt;-- file names don't have to be strict</span>
│   │   ├── 002.jpg
│   │   └── ...
│   ├── Volume 2/
│   │   ├── 001.jpg
│   │   └── ...
│   ├── Volume 1.mokuro         <span class="text-theme-tertiary">&lt;-- volume_title.mokuro (data file)</span>
│   ├── Volume 2.mokuro
│   └── Yotsuba&!.png           <span class="text-theme-tertiary">&lt;-- series cover image</span>
│
└── Another Series/
    ├── Chapter 1/
    │   ├── 01.png
    │   ├── 02.png
    │   └── ...
    ├── Chapter 1.mokuro
    └── Another Series.png</code></pre>
							</div>
						</div>
					{/if}
				</div>

				<!-- Mokuro Tool Section -->
				<div class="rounded-xl bg-theme-main border border-theme-border-light overflow-hidden">
					<button
						onclick={() => (isMokuroToolExpanded = !isMokuroToolExpanded)}
						class="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-theme-surface-hover transition-colors"
					>
						<span class="font-semibold text-theme-primary">Mokuro Tool</span>
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
							class="text-theme-secondary transition-transform {isMokuroToolExpanded
								? 'rotate-180'
								: ''}"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>

					{#if isMokuroToolExpanded}
						<div class="px-5 pb-4 space-y-3 text-sm text-theme-secondary">
							<p>This reader requires content processed by <strong class="text-theme-primary">mokuro</strong>.</p>

							<div class="flex items-start gap-2 mt-3">
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
									class="flex-shrink-0 mt-0.5"
								>
									<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
									<path d="M9 18c-4.51 2-5-2-7-2" />
								</svg>
								<div>
									<p class="font-semibold text-theme-primary">Mokuro Repository</p>
									<a
										href="https://github.com/kha-white/mokuro"
										target="_blank"
										rel="noopener noreferrer"
										class="text-accent hover:underline text-xs"
									>
										https://github.com/kha-white/mokuro
									</a>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Upload Drop Zone -->
				<label
					class="flex w-full cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-theme-border-light bg-theme-main p-12 hover:bg-theme-surface-hover hover:border-accent/50 transition-all group"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-tertiary group-hover:text-accent transition-colors mb-3"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" x2="12" y1="3" y2="15" />
					</svg>
					<span class="text-sm text-theme-secondary mb-1">Drag and drop / <span class="text-accent font-medium">choose folder</span></span>
					<input type="file" class="hidden" webkitdirectory bind:files />
				</label>

				<!-- Import Button -->
				<button
					onclick={() => {
						const input = document.querySelector('input[type="file"]');
						if (input) (input as HTMLInputElement).click();
					}}
					class="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
				>
					IMPORT
				</button>
			</div>
		{:else}
			<div class="p-6 space-y-4">
				<div class="flex justify-between text-sm font-medium text-theme-secondary">
					<span>Processing Queue</span>
					<span class="text-theme-primary">{completedJobs} / {totalJobs} Volumes</span>
				</div>

				<div
					class="max-h-[60vh] overflow-y-auto rounded-xl border border-theme-border bg-theme-main p-3 space-y-2"
				>
					{#each jobs as job (job.id)}
						<div
							class="rounded-lg bg-theme-surface p-4 border border-theme-border-light"
						>
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium truncate w-1/2 text-theme-primary" title={job.name}>
									{job.name}
								</span>
								<span class="text-xs font-bold uppercase tracking-wide">
									{#if job.status === 'pending'}
										<span class="text-theme-tertiary">Waiting</span>
									{:else if job.status === 'uploading'}
										<span class="text-accent">Uploading {job.progress}%</span>
									{:else if job.status === 'processing'}
										<span class="text-status-warning animate-pulse">Processing...</span>
									{:else if job.status === 'done'}
										<span class="text-status-success">{job.resultMsg || 'Done'}</span>
									{:else}
										<span class="text-status-error">Error</span>
									{/if}
								</span>
							</div>

							{#if job.status === 'uploading'}
								<div
									class="mt-3 h-2 w-full rounded-full bg-theme-main overflow-hidden"
								>
									<div
										class="h-full bg-accent transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
										style="width: {job.progress}%"
									></div>
								</div>
							{/if}

							{#if job.status === 'error'}
								<div class="mt-2 text-xs text-status-error">{job.resultMsg}</div>
							{/if}
						</div>
					{/each}
				</div>

				<div class="flex justify-end gap-3">
					{#if !isProcessingQueue}
						<button
							onclick={resetState}
							class="px-5 py-2.5 text-theme-secondary hover:text-white transition-colors rounded-lg hover:bg-theme-surface-hover"
						>
							Upload More
						</button>
						<button
							onclick={handleClose}
							class="px-5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
						>
							Done
						</button>
					{:else}
						<span class="text-xs text-theme-tertiary self-center"
							>Please wait for pipeline to finish...</span
						>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
