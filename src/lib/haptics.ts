/**
 * A short vibration on phones that support it (most Android phones; iPhones ignore it). Never
 * throws; does nothing on desktops. Used for a few rewarding moments only, not for every tap.
 */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    // Browsers refuse (and log an error) until the person has tapped the page; students have by the time it matters.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    navigator.vibrate(pattern);
  } catch {
    // Some browsers block vibration without a recent tap; that's fine.
  }
}
