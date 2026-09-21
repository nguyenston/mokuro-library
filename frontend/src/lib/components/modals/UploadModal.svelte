<script lang="ts">
  import { apiFetch, apiUpload } from '$lib/services/api';
  import { fade, scale } from 'svelte/transition';
  import { createJobsFromFiles, type UploadJob } from '$lib/utils/helpers/upload';
  import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
  import AriaLiveRegion from '$lib/components/feedback/AriaLiveRegion.svelte';
  import type { AsyncUploadResponse } from '$lib/types';

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
  let allJobsComplete = $derived(
    jobs.length > 0 && jobs.every((j) => j.status === 'done' || j.status === 'error')
  );
  let hasActiveUploads = $derived(
    isProcessingQueue || jobs.some((j) => j.status === 'uploading' || j.status === 'processing')
  );
  let uploadAnnouncement = $derived.by(() => {
    const activeJob = jobs.find((job) => job.status === 'uploading' || job.status === 'processing');
    if (!activeJob) return '';
    if (activeJob.status === 'uploading') {
      return `Uploading ${activeJob.name}: ${Math.round(activeJob.progress)}%`;
    }
    return `Processing ${activeJob.name}`;
  });

  const pollUploadStatus = async (job: UploadJob, jobId: string, onSuccess: () => void) => {
    const start = Date.now();
    const maxWaitMs = 10 * 60 * 1000;
    let errorCount = 0;

    while (Date.now() - start < maxWaitMs) {
      try {
        const status = await apiFetch<{
          status: 'queued' | 'processing' | 'completed' | 'failed';
          message: string;
        }>(`/api/library/upload/status/${jobId}`, {
          method: 'GET',
          showErrorToast: false
        });
        errorCount = 0; // Reset count on successful poll

        if (status.status === 'completed') {
          job.status = 'done';
          job.resultMsg = status.message || 'OK';
          onSuccess();
          return;
        }

        if (status.status === 'failed') {
          job.status = 'error';
          job.resultMsg = status.message || 'Upload failed';
          return;
        }
      } catch (err) {
        void err;
        errorCount++;
        // Only show error status in UI if it fails 3 times in a row
        if (errorCount >= 3) {
          job.status = 'error';
          job.resultMsg = `Connection lost. Retrying...`;
        }
        // If it fails 10 times, give up
        if (errorCount > 10) {
          job.status = 'error';
          job.resultMsg = `Polling failed: Network error.`;
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    job.status = 'error';
    job.resultMsg = 'Upload timed out';
  };

  // --- Actions ---
  const resetState = () => {
    files = null;
    jobs = [];
    isProcessingQueue = false;
    activeTab = 'upload';
  };

  const handleClose = () => {
    // Prevent closing if uploads are still in progress
    if (hasActiveUploads) {
      return;
    }

    onClose();

    // Only reset state after all jobs are complete
    if (allJobsComplete) {
      setTimeout(resetState, 200);
    }
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
    let jobPromises = [];

    for (const job of jobs) {
      if (job.status === 'done') continue;
      try {
        const check = await apiFetch<{ exists: boolean }>('/api/library/check', {
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

        if (
          job.metadata.seriesTitle ||
          job.metadata.volumeTitle ||
          job.metadata.volumeProgress ||
          job.metadata.seriesBookmarked
        ) {
          formData.append(
            'metadata',
            JSON.stringify({
              series_title: job.metadata.seriesTitle,
              series_description: job.metadata.seriesDescription,
              series_bookmarked: job.metadata.seriesBookmarked,
              volume_title: job.metadata.volumeTitle,
              volume_progress: job.metadata.volumeProgress
            })
          );
        }

        for (const file of job.files) {
          formData.append('files', file, file.webkitRelativePath);
        }

        const response = (await apiUpload('/api/library/upload?async=true', formData, (percent) => {
          job.progress = percent;
          if (percent === 100) job.status = 'processing';
        })) as AsyncUploadResponse;
        if (response.jobId) {
          job.status = 'processing';
          jobPromises.push(
            pollUploadStatus(job, response.jobId, () => {
              hasUpdates = true;
            })
          );
        } else {
          job.status = 'done';
          job.resultMsg = `OK`;
          hasUpdates = true;
        }
      } catch (err) {
        console.error(`Failed to upload ${job.name}`, err);
        job.status = 'error';
        job.resultMsg = (err as Error).message;
      }
    }

    await Promise.allSettled(jobPromises);

    isProcessingQueue = false;
    files = null;

    if (hasUpdates) {
      onUploadSuccess();
    }
  };
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity {hasActiveUploads
        ? 'cursor-not-allowed'
        : 'cursor-pointer'}"
      transition:fade={{ duration: 150 }}
      onclick={onClose}
      role="button"
      tabindex="0"
      onkeydown={(event) => event.key === 'Escape' && handleClose()}
      aria-label={hasActiveUploads ? 'Cannot close - uploads in progress' : 'Close modal'}
      title={hasActiveUploads ? 'Please wait for uploads to complete' : ''}
    ></div>

    <div
      class="relative w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <AriaLiveRegion message={uploadAnnouncement} />
      <div
        class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
      >
        <div class="flex items-center gap-3">
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
            class="text-accent"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <h2 class="text-2xl font-bold text-theme-primary">Import Volumes</h2>
        </div>
        <button
          onclick={handleClose}
          disabled={hasActiveUploads}
          class="p-2 rounded-lg text-theme-secondary transition-colors {hasActiveUploads
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:text-theme-primary hover:bg-theme-surface-hover'}"
          aria-label={hasActiveUploads ? 'Cannot close - uploads in progress' : 'Close'}
          title={hasActiveUploads ? 'Please wait for uploads to complete' : 'Close'}
        >
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="flex-1 p-6 space-y-6">
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
                : 'text-theme-secondary'}"
            >
              {option.label}
            </span>
          {/snippet}
        </MenuGridRadio>

        <div>
          {#if activeTab === 'upload'}
            {#if !hasJobs}
              <div class="flex flex-col justify-center">
                <label
                  class="flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed border-theme-border-light bg-theme-main hover:bg-theme-surface-hover hover:border-accent/50 transition-all cursor-pointer group"
                >
                  <div
                    class="w-16 h-16 rounded-full bg-theme-surface flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200"
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
                      class="text-theme-secondary group-hover:text-accent transition-colors"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                  </div>
                  <p class="text-lg font-medium text-theme-primary mb-1">Drag & Drop Folder</p>
                  <p class="text-sm text-theme-secondary">or click to browse</p>
                  <input type="file" class="hidden" webkitdirectory bind:files />
                </label>
              </div>
            {:else}
              <div class="flex-col space-y-4">
                <div class="flex justify-between items-end">
                  <h3 class="text-sm font-bold text-theme-secondary uppercase tracking-wider">
                    Queue Status
                  </h3>
                  <span class="text-xs font-mono text-accent bg-accent-surface px-2 py-1 rounded">
                    {completedJobs} / {totalJobs} Completed
                  </span>
                </div>

                <div class="h-[40vh] space-y-2 overflow-y-auto">
                  {#each jobs as job (job.id)}
                    <div
                      class="p-4 rounded-xl bg-theme-main border border-theme-border-light flex items-center gap-4"
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
                            class="text-sm font-medium text-theme-primary truncate min-w-0 flex-1"
                            title={job.name}>{job.name}</span
                          >
                          <span
                            class="text-xs font-bold text-theme-secondary uppercase whitespace-nowrap flex-shrink-0"
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

                <div class="flex flex-col gap-2 pt-4">
                  {#if hasActiveUploads}
                    <div
                      class="flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2"
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
                        class="flex-shrink-0"
                      >
                        <path
                          d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                        />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span class="font-medium">Uploads in progress - please wait to close</span>
                    </div>
                  {/if}
                  <div class="flex justify-end">
                    {#if !isProcessingQueue}
                      <button
                        onclick={handleClose}
                        disabled={hasActiveUploads}
                        class="px-6 py-2.5 rounded-xl font-semibold transition-colors border {hasActiveUploads
                          ? 'opacity-50 cursor-not-allowed bg-theme-main text-theme-secondary border-theme-border-light'
                          : 'bg-theme-main hover:bg-theme-surface-hover text-theme-primary border-theme-border-light'}"
                        title={hasActiveUploads
                          ? 'Please wait for uploads to complete'
                          : 'Close upload modal'}
                      >
                        Done
                      </button>
                    {:else}
                      <span class="text-sm text-theme-secondary animate-pulse">Processing...</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          {:else}
            <div class="space-y-6 text-theme-primary">
              <section class="space-y-3">
                <h3 class="text-lg font-bold theme-primary flex items-center gap-2">
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
                <p class="text-sm leading-relaxed text-theme-secondary">
                  Mokuro Library allows you to upload entire folders at once. The system will parse
                  your folder structure to automatically identify Series and Volumes.
                </p>
                <div
                  class="bg-theme-main rounded-xl p-4 border border-theme-border-light font-mono text-xs text-theme-secondary"
                >
                  <div class="text-accent mb-2 font-bold">// Recommended Structure</div>
                  <div>
                    My Manga Uploads/ <span class="text-theme-tertiary"
                      >&lt;-- Point upload here</span
                    >
                  </div>

                  <div class="pl-4">
                    ├── Yotsuba&!/ <span class="text-theme-tertiary">&lt;-- Series Title</span>
                  </div>
                  <div class="pl-8">
                    ├── Volume 1/ <span class="text-theme-tertiary">&lt;-- Volume Title</span>
                  </div>
                  <div class="pl-12 text-theme-tertiary">├── 001.jpg</div>
                  <div class="pl-12 text-theme-tertiary">└── ...</div>

                  <div class="pl-8">├── Volume 2/</div>
                  <div class="pl-12 text-theme-tertiary">├── 001.jpg</div>
                  <div class="pl-12 text-theme-tertiary">└── ...</div>

                  <div class="pl-8 text-status-success">
                    ├── Volume 1.mokuro <span class="text-theme-tertiary">&lt;-- Data File</span>
                  </div>
                  <div class="pl-8 text-status-success">├── Volume 2.mokuro</div>
                  <div class="pl-8 text-status-info">
                    └── Yotsuba&!.png <span class="text-theme-tertiary">&lt;-- Series Cover</span>
                  </div>

                  <div class="h-2"></div>

                  <div class="pl-4">└── Another Series/</div>
                  <div class="pl-8">├── Chapter 1/</div>
                  <div class="pl-12 text-theme-tertiary">├── 01.png</div>
                  <div class="pl-12 text-theme-tertiary">└── ...</div>
                  <div class="pl-8 text-status-success">├── Chapter 1.mokuro</div>
                  <div class="pl-4 text-status-info">└── Another Series.png</div>
                </div>
              </section>

              <section class="space-y-3">
                <h3 class="text-lg font-bold theme-primary flex items-center gap-2">
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
                <p class="text-sm leading-relaxed text-theme-secondary">
                  To enable OCR features, you need to generate <code
                    class="px-1.5 py-0.5 rounded bg-theme-main border border-theme-border-light text-accent font-mono text-xs"
                    >.mokuro</code
                  > files using the Mokuro tool. Place these files alongside your image folders (not inside
                  them).
                </p>
                <a
                  href="https://github.com/kha-white/mokuro"
                  target="_blank"
                  class="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  View Mokuro on GitHub &rarr;
                </a>
              </section>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
