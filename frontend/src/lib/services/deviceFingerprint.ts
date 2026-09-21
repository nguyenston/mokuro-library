/**
 * Generates a device fingerprint based on browser characteristics.
 * This is NOT meant to be cryptographically secure, just to detect
 * cookie theft across different devices.
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('Device fingerprint can only be generated in browser environment');
  }

  const components: string[] = [];

  // User agent
  components.push(navigator.userAgent);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // Hardware concurrency (CPU cores)
  components.push((navigator.hardwareConcurrency || 0).toString());

  // Device memory (if available)
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (deviceMemory) {
    components.push(deviceMemory.toString());
  }

  // Canvas fingerprint (simplified)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Mokuro Library', 2, 2);
      const data = canvas.toDataURL();
      components.push(data);
    }
  } catch {
    // Canvas fingerprinting blocked
  }

  // Combine all components
  const fingerprintString = components.join('|||');

  // Hash using SubtleCrypto
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
};

/**
 * Stores device fingerprint in sessionStorage for consistency.
 */
export const getStoredFingerprint = async (): Promise<string> => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    throw new Error('Device fingerprint can only be accessed in browser environment');
  }

  const stored = sessionStorage.getItem('deviceFingerprint');
  if (stored) {
    return stored;
  }

  const fingerprint = await generateDeviceFingerprint();
  sessionStorage.setItem('deviceFingerprint', fingerprint);
  return fingerprint;
};
