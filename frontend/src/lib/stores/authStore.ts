import { writable } from 'svelte/store';
import { apiFetch, apiFetchWithRefresh } from '$lib/services/api';
import { apiCache } from '$lib/utils/caching/apiCache';
import { startTokenRefresh, stopTokenRefresh } from '$lib/services/tokenRefresh';
import type { KeybindsConfig } from '$lib/keybinds';

// Define the shape of user settings
export interface ReaderSettingsData {
  layoutMode?: 'single' | 'double' | 'vertical';
  readingDirection?: 'ltr' | 'rtl';
  firstPageIsCover?: boolean;
  retainZoom?: boolean;
  navZoneWidth?: number;
  showTriggerOutline?: boolean;
  autoFullscreen?: boolean;
  hideHUD?: boolean;
  autoCompleteVolume?: boolean;
  nightMode?: {
    enabled: boolean;
    scheduleEnabled: boolean;
    intensity: number;
    redShift: number;
    startHour: number;
    endHour: number;
  };
  invertColor?: {
    enabled: boolean;
    scheduleEnabled: boolean;
    intensity: number;
    startHour: number;
    endHour: number;
  };
  keybinds?: KeybindsConfig;
}

// Define the type for our user object
// This matches what the backend sends
export interface AuthUser {
  id: string;
  username: string;
  settings: ReaderSettingsData;
  expiresIn: number;
  role?: 'admin' | 'user'; // Optional role property (derived from id === 'admin')
}

// Create a writable store that holds an AuthUser or null
export const user = writable<AuthUser | null | undefined>();
export const authReady = writable(false);

// Subscribe to user changes to manage token refresh
user.subscribe((currentUser) => {
  if (currentUser) {
    // User logged in - start proactive token refresh
    startTokenRefresh();
  } else {
    // User logged out - stop token refresh
    stopTokenRefresh();
  }
});

// Track if user was previously authenticated to detect session expiration
let wasAuthenticated = false;

/**
 * Checks the /api/auth/me endpoint to see if a valid
 * session cookie exists.
 * This should be called when the app first loads.
 */
export async function checkAuth() {
  try {
    // Try to get the current user - suppress error toast on initial check
    const userData = await apiFetchWithRefresh<AuthUser>('/api/auth/me', {
      showErrorToast: false
    });

    // Ensure settings is an object, even if it's null from the DB
    if (!userData.settings) {
      userData.settings = {};
    }
    const authUser = userData;
    user.set(authUser);

    // Clear cache if user changed
    apiCache.setUserId(authUser.id);

    // Track successful auth
    wasAuthenticated = true;
  } catch (error) {
    // Log to console for debugging
    if (error instanceof Error) {
      console.debug('Auth check failed:', error.message);
    }

    // If user WAS authenticated but now isn't, show error and clear cache (session expired)
    if (wasAuthenticated) {
      console.debug('Session expired, clearing cache');

      // Show user-friendly message about session expiration
      const { toastStore } = await import('./toastStore.svelte');
      toastStore.error('Your session has expired. Please sign in again.');

      apiCache.clearAllCache();
      wasAuthenticated = false;
    }

    // If it fails (e.g., 401), we're not logged in
    user.set(null);
    apiCache.setUserId(null);
  } finally {
    authReady.set(true);
  }
}

/**
 * Start periodic auth monitoring to detect session expiration
 * Returns cleanup function to stop monitoring
 */
export function startAuthMonitoring() {
  // Check auth every 5 minutes
  const interval = setInterval(
    async () => {
      await checkAuth();
    },
    5 * 60 * 1000
  );

  // Cleanup function
  return () => clearInterval(interval);
}

/**
 * Optimistically updates settings.
 * Merges patch locally, then sends patch to the server.
 * Reverts local state if the server fails.
 */
export async function updateSettings(settingsPatch: ReaderSettingsData) {
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
      body: settingsPatch // Send only the changes
    });
  } catch (error) {
    console.error('Failed to save settings, reverting:', error);
    // If the save fails, revert to the old state
    user.set(oldUser);
  }
}
