import { writable } from 'svelte/store';
import { apiFetch } from './api';

/**
 * User reader settings that persist across sessions.
 * These settings control the reader UI and behavior.
 */
export interface ReaderSettingsData {
  layoutMode?: 'single' | 'double' | 'vertical';
  readingDirection?: 'ltr' | 'rtl';
  doublePageOffset?: 'even' | 'odd';
  retainZoom?: boolean;
  navZoneWidth?: number;
  showTriggerOutline?: boolean;
}

/**
 * Authenticated user object returned from the backend.
 * Contains user identity and persisted settings.
 */
export interface AuthUser {
  id: string;
  username: string;
  settings: ReaderSettingsData; // We'll use 'any' for the JSON blob
}

/**
 * Global user authentication store.
 * - `undefined`: Authentication status unknown (initial state, checking)
 * - `null`: Not authenticated
 * - `AuthUser`: Authenticated user with settings
 */
export const user = writable<AuthUser | null | undefined>(undefined);

/**
 * Type guard to validate that userData matches the AuthUser interface.
 * Provides runtime type safety for API responses.
 * @param userData - Unknown data to validate
 * @returns True if userData is a valid AuthUser object
 */
function validateAuthUser(userData: unknown): userData is AuthUser {
  if (!userData || typeof userData !== 'object') {
    console.warn('Invalid user data: not an object');
    return false;
  }
  const data = userData as Record<string, unknown>;
  const isValid = (
    typeof data.id === 'string' &&
    typeof data.username === 'string' &&
    (data.settings === null || typeof data.settings === 'object')
  );

  if (!isValid) {
    console.warn('Invalid user data structure:', { id: typeof data.id, username: typeof data.username, settings: typeof data.settings });
  }

  return isValid;
}

/**
 * Checks authentication status by querying the backend.
 * Should be called once when the app first loads.
 * Updates the user store with the result.
 * @returns Promise that resolves when auth check is complete
 */
export async function checkAuth(): Promise<void> {
  try {
    // Try to get the current user
    // If successful, update the store
    const userData = await apiFetch('/api/auth/me');

    // Validate the response
    if (!validateAuthUser(userData)) {
      console.warn('Invalid user data received from server');
      user.set(null);
      return;
    }

    // Ensure settings is an object, even if it's null from the DB
    if (!userData.settings) {
      userData.settings = {};
    }
    user.set(userData);
  } catch (error) {
    // If it fails (e.g., 401), we're not logged in
    user.set(null);
  }
}

/**
 * Updates user settings with optimistic local update.
 * Immediately applies changes locally, then syncs with server.
 * Reverts to previous state if server update fails.
 * @param settingsPatch - Partial settings object with values to update
 * @throws Error if not authenticated or update fails
 */
export async function updateSettings(settingsPatch: ReaderSettingsData): Promise<void> {
  let oldUser: AuthUser | null | undefined;

  // Optimistic local update
  user.update((currentUser) => {
    oldUser = currentUser; // Store the old state in case we need to revert
    if (!currentUser) return null;

    const newSettings = { ...currentUser.settings, ...settingsPatch };
    return { ...currentUser, settings: newSettings };
  });

  // Send the PATCH to the server
  try {
    await apiFetch('/api/settings', {
      method: 'PUT',
      body: settingsPatch, // Send only the changes
    });
  } catch (error) {
    console.error('Failed to save settings, reverting:', error);
    // If the save fails, revert to the old state
    user.set(oldUser);
  }
}
