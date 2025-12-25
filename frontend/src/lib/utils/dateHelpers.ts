/**
 * Date utility functions for the application
 */

const EPOCH_2000 = new Date('2000-01-01T00:00:00.000Z');

/**
 * Formats a last read date, returning "Never" for dates before 2000-01-01
 * @param dateString - ISO date string from the database
 * @returns Formatted date string or "Never"
 */
export function formatLastReadDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Never';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // Check if date is invalid
  if (isNaN(date.getTime())) {
    return 'Never';
  }

  // If date is before 2000-01-01, show "Never"
  if (date < EPOCH_2000) {
    return 'Never';
  }

  // Format the date nicely
  return formatRelativeDate(date);
}

/**
 * Formats a date as a relative time string (e.g., "2 hours ago", "3 days ago")
 * Falls back to absolute date for older dates
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  } else {
    // For dates older than a year, show absolute date
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Checks if a date should be considered as "never read"
 */
export function isNeverRead(dateString: string | Date | null | undefined): boolean {
  if (!dateString) return true;

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) {
    return true;
  }

  return date < EPOCH_2000;
}
