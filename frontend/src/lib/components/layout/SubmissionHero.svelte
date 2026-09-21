<script lang="ts">
  import type { SubmissionDetail } from '$lib/types';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';
  import Badge from '$lib/components/controls/Badge.svelte';
  import { SvelteDate } from 'svelte/reactivity';
  import { Shield, GitMerge, User, Calendar, Hash, BookOpen } from 'lucide-svelte';
  import Icon from '$lib/components/controls/Icon.svelte';

  let {
    submission,
    actions
  }: {
    submission: SubmissionDetail;
    actions?: import('svelte').Snippet;
  } = $props();

  // 1. Derive the "Hero" cover
  const coverUrlSeriesId = submission.targetSeries?.id ?? submission.sourceSeries.id;
  const coverUrl = `/api/files/series/${coverUrlSeriesId}/cover`;

  // 2. Determine Series Title & Type
  const isMerge = !!submission.targetSeries;
  const seriesTitle = isMerge
    ? submission.targetSeries!.sortTitle
    : submission.sourceSeries.sortTitle;

  // 3. Status Styling
  const statusColors = {
    pending: 'bg-status-warning/20 text-status-warning border-status-warning/30',
    accepted: 'bg-status-success/20 text-status-success border-status-success/30',
    rejected: 'bg-status-danger/20 text-status-danger border-status-danger/30'
  };

  const statusEmoji = {
    pending: '⏳',
    accepted: '✅',
    rejected: '❌'
  };

  // 4. Handle Image Load Error (Fallback Switch)
  let imageLoadError = $state(false);
</script>

<div
  class="relative w-full overflow-hidden rounded-3xl bg-theme-surface border border-theme-border shadow-2xl group"
>
  <div class="absolute inset-0 z-0 overflow-hidden">
    {#if coverUrl && !imageLoadError}
      <AuthenticatedImage
        src={coverUrl}
        alt=""
        class="w-full h-full object-cover blur-3xl opacity-30 scale-110 transition-transform duration-[20s] ease-linear group-hover:scale-125"
      />
    {/if}
    <div
      class="absolute inset-0 bg-gradient-to-r from-theme-surface via-theme-surface/95 to-theme-surface/40"
    ></div>
    <div
      class="absolute inset-0 bg-gradient-to-t from-theme-surface via-transparent to-transparent"
    ></div>
  </div>

  <div class="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start">
    <div class="flex-shrink-0 relative mx-auto md:mx-0">
      <div
        class="w-48 aspect-[7/11] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden border-2 border-theme-primary/10 bg-theme-main relative group-hover:shadow-[0_12px_48px_rgba(0,0,0,0.6)] transition-all duration-500"
      >
        {#if coverUrl && !imageLoadError}
          <AuthenticatedImage
            src={coverUrl}
            alt={seriesTitle!}
            class="w-full h-full object-cover"
            onerror={() => (imageLoadError = true)}
          />
        {:else}
          <div
            class="flex h-full w-full items-center justify-center text-theme-tertiary bg-theme-surface/50 font-bold text-6xl"
          >
            {seriesTitle ? seriesTitle[0].toUpperCase() : '?'}
          </div>
        {/if}
      </div>
    </div>

    <div class="flex-1 min-w-0 w-full">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <Badge
          class="{statusColors[
            submission.status
          ]} text-sm px-3 py-1 flex items-center gap-2 shadow-sm backdrop-blur-md"
        >
          <span>{statusEmoji[submission.status]}</span>
          <span class="font-bold tracking-wide">{submission.status.toUpperCase()}</span>
        </Badge>

        <div
          class="flex items-center gap-1.5 text-xs font-mono text-theme-tertiary px-2 py-1 rounded-md bg-theme-main/50 border border-theme-border/50"
        >
          <Icon icon={Hash} size={10} />
          <span class="hidden sm:inline">{submission.id}</span>
          <span class="inline sm:hidden">{submission.id.slice(0, 8)}</span>
        </div>
      </div>

      <h1
        class="text-3xl sm:text-4xl md:text-5xl font-black text-theme-primary tracking-tight mb-2 drop-shadow-sm leading-tight"
      >
        {seriesTitle}
      </h1>

      <div class="flex items-center gap-2 mb-6 text-sm">
        {#if isMerge}
          <span
            class="text-accent flex items-center gap-1.5 font-bold bg-accent/10 px-2 py-0.5 rounded text-xs border border-accent/20"
          >
            <Icon icon={GitMerge} size={12} />
            MERGE REQUEST
          </span>
        {:else}
          <span
            class="text-status-success flex items-center gap-1.5 font-bold bg-status-success/10 px-2 py-0.5 rounded text-xs border border-status-success/20"
          >
            <Icon icon={Shield} size={12} />
            NEW SERIES
          </span>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div
          class="flex items-center gap-3 p-3 rounded-xl bg-theme-main/40 border border-theme-border/50"
        >
          <div
            class="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-secondary shadow-sm"
          >
            <Icon icon={User} size={18} />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] uppercase font-bold text-theme-tertiary tracking-wider"
              >Submitter</span
            >
            <span class="font-semibold text-theme-primary">{submission.user.username}</span>
          </div>
        </div>

        <div
          class="flex items-center gap-3 p-3 rounded-xl bg-theme-main/40 border border-theme-border/50"
        >
          <div
            class="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-secondary shadow-sm"
          >
            <Icon icon={Calendar} size={18} />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] uppercase font-bold text-theme-tertiary tracking-wider"
              >Submitted</span
            >
            <span class="font-semibold text-theme-primary">
              {new SvelteDate(submission.submittedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        <div
          class="flex items-center gap-3 p-3 rounded-xl bg-theme-main/40 border border-theme-border/50"
        >
          <div
            class="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center text-theme-secondary shadow-sm"
          >
            <Icon icon={BookOpen} size={18} />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] uppercase font-bold text-theme-tertiary tracking-wider"
              >Volumes</span
            >
            <span class="font-semibold text-theme-primary">
              {submission.volumes.length}
            </span>
          </div>
        </div>
      </div>

      {#if submission.reviewNote}
        <div class="mb-8 p-4 rounded-xl bg-status-danger/5 border border-status-danger/20 relative">
          <div
            class="absolute -top-2.5 left-4 bg-theme-surface px-2 text-xs font-bold text-status-danger flex items-center gap-1 border border-status-danger/20 rounded"
          >
            ADMIN NOTE
          </div>
          <p class="text-theme-secondary text-sm italic">{submission.reviewNote}</p>
        </div>
      {/if}

      {#if actions}
        <div class="flex flex-wrap gap-3 pt-4 border-t border-theme-border/40">
          {@render actions()}
        </div>
      {/if}
    </div>
  </div>
</div>
