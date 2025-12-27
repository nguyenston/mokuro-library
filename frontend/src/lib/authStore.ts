import { writable } from 'svelte/store';
import { apiFetch } from './api';

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
  }
}

// Define the type for our user object
// This matches what the backend sends
export interface AuthUser {
  id: string;
  username: string;
  settings: ReaderSettingsData; // We'll use 'any' for the JSON blob
}

// Create a writable store that holds an AuthUser or null
export const user = writable<AuthUser | null | undefined>();

/**
 * Checks the /api/auth/me endpoint to see if a valid
 * session cookie exists.
 * This should be called when the app first loads.
 */
export async function checkAuth() {
  try {
    // Try to get the current user
    // If successful, update the store
    const userData = await apiFetch('/api/auth/me');

    // Ensure settings is an object, even if it's null from the DB
    if (!userData.settings) {
      userData.settings = {};
    }
    user.set(userData as AuthUser);
  } catch (error) {
    // If it fails (e.g., 401), we're not logged in
    user.set(null);
  }
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
      body: settingsPatch, // Send only the changes
    });
  } catch (error) {
    console.error('Failed to save settings, reverting:', error);
    // If the save fails, revert to the old state
    user.set(oldUser);
  }
}
