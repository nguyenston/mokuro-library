/**
 * Schedule Helper Utilities
 *
 * Utilities for working with time-based schedules (night mode, auto-invert, etc.)
 */

/**
 * Checks if a schedule is currently active based on time range
 *
 * @param enabled - Whether the feature is enabled at all
 * @param scheduleEnabled - Whether schedule-based activation is enabled
 * @param startHour - Start hour (0-23)
 * @param endHour - End hour (0-23)
 * @param currentHour - Current hour (0-23), defaults to current time
 * @returns true if the schedule is currently active
 *
 * @example
 * ```typescript
 * // Check if night mode should be active (22:00 - 06:00)
 * const isActive = isScheduleActive(true, true, 22, 6, new Date().getHours());
 * ```
 */
import { SvelteDate } from 'svelte/reactivity';

export function isScheduleActive(
  enabled: boolean,
  scheduleEnabled: boolean,
  startHour: number,
  endHour: number,
  currentHour = new SvelteDate().getHours()
): boolean {
  // If feature is disabled, always return false
  if (!enabled) return false;

  // If schedule is disabled, feature is always active when enabled
  if (!scheduleEnabled) return true;

  // Handle schedule that crosses midnight (e.g., 22:00 - 06:00)
  if (startHour <= endHour) {
    // Normal range (e.g., 08:00 - 18:00)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Range crosses midnight (e.g., 22:00 - 06:00)
    return currentHour >= startHour || currentHour < endHour;
  }
}

/**
 * Formats an hour (0-23) as a 12-hour time string
 *
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Formatted time string (e.g., "10:00 PM")
 */
export function formatHour12(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${period}`;
}

/**
 * Formats an hour (0-23) as a 24-hour time string
 *
 * @param hour - Hour in 24-hour format (0-23)
 * @returns Formatted time string (e.g., "22:00")
 */
export function formatHour24(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/**
 * Calculates the duration of a schedule in hours
 *
 * @param startHour - Start hour (0-23)
 * @param endHour - End hour (0-23)
 * @returns Duration in hours
 */
export function getScheduleDuration(startHour: number, endHour: number): number {
  if (startHour <= endHour) {
    return endHour - startHour;
  } else {
    return 24 - startHour + endHour;
  }
}

/**
 * Validates a schedule configuration
 *
 * @param startHour - Start hour
 * @param endHour - End hour
 * @returns true if valid, false otherwise
 */
export function isValidSchedule(startHour: number, endHour: number): boolean {
  return (
    Number.isInteger(startHour) &&
    Number.isInteger(endHour) &&
    startHour >= 0 &&
    startHour <= 23 &&
    endHour >= 0 &&
    endHour <= 23
  );
}
