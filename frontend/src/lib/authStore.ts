import { writable } from 'svelte/store';
import { apiFetch } from './api';

// Define the type for our user object
// This matches what the backend sends
export interface AuthUser {
  id: string;
  username: string;
  settings: any; // We'll use 'any' for the JSON blob
}

// Create a writable store that holds an AuthUser or null
export const user = writable<AuthUser | null>(null);

/**
 * Checks the /api/auth/me endpoint to see if a valid
 * session cookie exists.
 * This should be called when the app first loads.
 */
export async function checkAuth() {
  try {
    // Try to get the current user
    const userData = await apiFetch('/api/auth/me');
    // If successful, update the store
    user.set(userData as AuthUser);
  } catch (error) {
    // If it fails (e.g., 401), we're not logged in
    user.set(null);
  }
}
