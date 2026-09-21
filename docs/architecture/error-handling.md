# Error Handling Usage Guide

## Toast Notifications

### Basic Usage

```ts
import { toastStore } from '$lib/stores/toastStore.svelte';

// Show different types of toasts
toastStore.success('Volume saved successfully');
toastStore.error('Failed to load volume');
toastStore.warning('This action cannot be undone');
toastStore.info('Processing OCR data...');

// Custom duration (0 = never auto-dismiss)
toastStore.error('Critical error - please contact support', 0);
```

### Automatic API Error Handling

The `apiFetch` function automatically shows error toasts:

```ts
import { apiFetch } from '$lib/api';

// Auto-shows error toast on failure
const data = await apiFetch('/api/library');

// Disable automatic toast
const data = await apiFetch('/api/library', { showErrorToast: false });

// Enable retry with exponential backoff
const data = await apiFetch('/api/library', { retry: true });
```

## Retry Mechanism

### Using retryWithBackoff

```ts
import { retryWithBackoff } from '$lib/utils/retry';

try {
  const result = await retryWithBackoff(
    async () => {
      return await someUnreliableOperation();
    },
    {
      retries: 3,
      delay: 1000,
      backoffMultiplier: 2,
      onRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`);
      }
    }
  );
} catch (error) {
  toastStore.error('Operation failed after 3 retries');
}
```

### Retry Strategy

- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds (1000 * 2^1)
- Attempt 4: After 4 seconds (1000 * 2^2)

## Examples

### Form Submission with Error Handling

```svelte
<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { toastStore } from '$lib/stores/toastStore.svelte';

  let loading = $state(false);

  async function handleSubmit() {
    loading = true;
    try {
      await apiFetch('/api/library/volume', {
        method: 'POST',
        body: { title: 'New Volume' },
        retry: true // Enable retry for network issues
      });
      toastStore.success('Volume created successfully');
    } catch (error) {
      // Error toast already shown by apiFetch
      // Handle cleanup or additional logic here
    } finally {
      loading = false;
    }
  }
</script>
```

### Manual Error Handling

```svelte
<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { toastStore } from '$lib/stores/toastStore.svelte';

  async function deleteVolume(id: string) {
    try {
      await apiFetch(`/api/library/${id}`, {
        method: 'DELETE',
        showErrorToast: false // Handle errors manually
      });
      toastStore.success('Volume deleted');
    } catch (error) {
      // Custom error handling
      if (error.message.includes('not found')) {
        toastStore.warning('Volume was already deleted');
      } else {
        toastStore.error('Failed to delete volume');
      }
    }
  }
</script>
```

## Toast Container

The `ToastContainer` component is already included in `+layout.svelte` and handles rendering all toasts globally.

## Migration Guide

### Before

```ts
try {
  const response = await fetch('/api/library');
  if (!response.ok) {
    throw new Error('Failed to load library');
  }
  const data = await response.json();
} catch (error) {
  console.error(error);
  // No user feedback
}
```

### After

```ts
// Automatic error handling with user feedback
const data = await apiFetch('/api/library');
```
