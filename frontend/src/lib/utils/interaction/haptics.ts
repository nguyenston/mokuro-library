/**
 * Trigger haptic feedback on supported devices
 * @param pattern Single duration or array of durations [vibrate, pause, vibrate, ...]
 */
export function vibrate(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export const HAPTIC_PATTERNS = {
  light: 10,
  medium: 20,
  heavy: 50,
  success: [10, 20, 10],
  error: [50, 50, 50],
  warning: [30, 20, 30]
} as const;
