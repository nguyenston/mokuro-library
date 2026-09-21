import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ToastContainer from '../feedback/ToastContainer.svelte';
import { toastStore } from '$lib/stores/toastStore.svelte.ts';

describe('ToastContainer', () => {
  it('renders a toast message', async () => {
    render(ToastContainer);
    toastStore.success('Saved', 0);

    expect(await screen.findByText('Saved')).toBeTruthy();
  });
});
