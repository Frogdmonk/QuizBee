import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Presentational password requirements that tick as the teacher types. The form's Zod schema
 * stays the authority; this only mirrors it (8+ characters, letters and numbers, matching confirm).
 */
export function PasswordChecklist({ password = '', confirm = '' }: { password?: string; confirm?: string }) {
  const items = [
    { label: '8 or more characters', met: password.length >= 8 },
    { label: 'A letter', met: /[A-Za-z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'Passwords match', met: confirm.length > 0 && confirm === password },
  ];
  return (
    <ul aria-label="Password requirements" className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className={cn('flex items-center gap-2 text-caption', item.met ? 'text-success-600' : 'text-ink-500')}>
          <span
            aria-hidden
            className={cn(
              'grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-[var(--dur-fast)]',
              item.met ? 'border-success-600 bg-success-600 text-white' : 'border-line-strong',
            )}
          >
            {item.met && <Check className="size-3" strokeWidth={3} />}
          </span>
          {item.label}
          <span className="sr-only">{item.met ? '(done)' : '(not yet)'}</span>
        </li>
      ))}
    </ul>
  );
}
