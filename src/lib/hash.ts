/** Stable small hash used to pick an answer colour for covers and monograms. Indices never change. */
export function hashIndex(text: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

/** Up to two initials from a real name ("Ms Rivera" → "MR"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : ([...parts[0]][1] ?? '');
  return (first + last).toUpperCase();
}
