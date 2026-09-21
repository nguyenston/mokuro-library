import { refreshAccessToken } from './api';

// Configuration
const DEFAULT_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 mins fallback
const CHANNEL_NAME = 'mokuro-token-refresh';

// State
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let refreshIntervalMs = DEFAULT_REFRESH_INTERVAL;

/**
 * Updates the refresh interval dynamically based on the token's life.
 * We aim to refresh at 90% of the token's lifetime.
 */
export const updateRefreshInterval = (seconds: number) => {
  if (!seconds) return;

  // Calculate 90% of the duration (in milliseconds)
  const newInterval = (seconds * 0.9) * 1000;

  // Only restart if the time is significantly different (>1 minute difference)
  if (Math.abs(newInterval - refreshIntervalMs) > 60000) {
    refreshIntervalMs = newInterval;
    console.debug(`[TokenRefresh] Interval adjusted to ${(refreshIntervalMs / 1000 / 60).toFixed(1)} minutes`);

    // Restart the timer with the new schedule
    restartTokenRefresh();
  }
};

/**
 * Sets up BroadcastChannel for multi-tab coordination
 */
function setupBroadcastChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'TOKEN_REFRESHED') {
        console.debug('[TokenRefresh] Another tab refreshed the token. Resetting local timer.');

        // If the other tab sent the new expiry, update our interval
        if (event.data.expiresIn) {
          updateRefreshInterval(event.data.expiresIn);
        }

        // Restart our timer so we don't refresh immediately
        restartTokenRefresh();
      }
    };
  } catch (e) {
    console.warn('[TokenRefresh] Failed to setup BroadcastChannel', e);
  }
}

function notifyTokenRefreshed(expiresIn?: number) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'TOKEN_REFRESHED',
      timestamp: Date.now(),
      expiresIn
    });
  }
}

export const startTokenRefresh = () => {
  if (refreshTimer) return; // Already running

  if (!broadcastChannel) {
    setupBroadcastChannel();
  }

  console.debug(`[TokenRefresh] Timer started. Next refresh in ${(refreshIntervalMs / 1000 / 60).toFixed(1)} mins`);

  scheduleNextRefresh();
};

function scheduleNextRefresh() {
  // Clear any existing timer just in case
  if (refreshTimer) clearTimeout(refreshTimer);

  // Use setTimeout (instead of setInterval) to allow dynamic interval changes
  refreshTimer = setTimeout(async () => {
    await performRefresh();
    // Schedule the next one
    scheduleNextRefresh();
  }, refreshIntervalMs);
}

async function performRefresh() {
  console.debug('[TokenRefresh] Triggering scheduled refresh...');

  // Note: We removed the "isUserActive" check to support infinite sessions
  const response = await refreshAccessToken();

  // Handle response (supports both boolean and object return types)
  if (response && typeof response === 'object' && 'expiresIn' in response) {
    const expiresIn = (response as any).expiresIn;
    updateRefreshInterval(expiresIn);
    notifyTokenRefreshed(expiresIn);
  } else if (response) {
    // Fallback if backend doesn't return expiry
    notifyTokenRefreshed();
  }
}

export const stopTokenRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
  console.debug('[TokenRefresh] Timer stopped');
};

function restartTokenRefresh() {
  // Reset the countdown without closing the channel
  if (refreshTimer) clearTimeout(refreshTimer);
  scheduleNextRefresh();
}

export const isTokenRefreshActive = (): boolean => {
  return refreshTimer !== null;
};
