<script lang="ts">
  import { apiFetch } from '$lib/services/api';
  import { user } from '$lib/stores/authStore';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import Button from '$lib/components/controls/Button.svelte';
  import { Send } from 'lucide-svelte';
  import { SvelteDate } from 'svelte/reactivity';

  type Comment = {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
    };
  };

  let { comments, submissionId } = $props<{
    comments: Comment[];
    submissionId: string;
  }>();

  let newComment = $state('');
  let isPosting = $state(false);
  let error = $state<string | null>(null);

  async function postComment() {
    if (!newComment.trim()) return;

    isPosting = true;
    error = null;

    try {
      const createdComment = await apiFetch<Comment>(
        `/api/contributions/submissions/${submissionId}/comments`,
        {
          method: 'POST',
          body: { content: newComment.trim() }
        }
      );
      comments = [...comments, createdComment];
      newComment = '';
      toastStore.success('Comment posted.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to post comment.';
      error = message;
      toastStore.error(message);
    } finally {
      isPosting = false;
    }
  }

  function formatTime(dateString: string) {
    const date = new SvelteDate(dateString);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
</script>

<div class="mt-8">
  <h2 class="text-xl font-bold mb-4">Comment Thread</h2>
  <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2">
    {#each comments as comment (comment.id)}
      {@const isOwnComment = comment.user.id === $user?.id}
      {@const bubbleClass = `p-3 rounded-lg ${isOwnComment ? 'bg-accent/20' : 'bg-white/10'}`}
      <div class="flex gap-3 items-start" class:flex-row-reverse={isOwnComment}>
        <div
          class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm flex-shrink-0"
        >
          {comment.user.username.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1">
          <div class={bubbleClass}>
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-sm">{comment.user.username}</span>
              <span class="text-xs text-white/50">{formatTime(comment.createdAt)}</span>
            </div>
            <p class="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
        </div>
      </div>
    {:else}
      <div class="text-center py-8 text-sm text-white/50">
        No comments yet. Start the conversation!
      </div>
    {/each}
  </div>

  <div class="mt-6">
    <textarea
      bind:value={newComment}
      rows="3"
      class="w-full bg-white/5 border border-white/20 rounded-md p-2 text-sm focus:ring-accent focus:border-accent"
      placeholder="Write a comment..."
      disabled={isPosting}
    ></textarea>
    {#if error}
      <p class="text-red-400 text-sm mt-1">{error}</p>
    {/if}
    <div class="mt-2 flex justify-end">
      <Button onclick={postComment} is_loading={isPosting} disabled={!newComment.trim()}>
        {#snippet icon()}
          <Send class="w-4 h-4" />
        {/snippet}
        Post Comment
      </Button>
    </div>
  </div>
</div>
