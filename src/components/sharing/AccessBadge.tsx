import { Copy, Eye, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ACCESS_LABELS } from '@/lib/workspace-rules';
import type { QuizAccess } from '@/types/workspace';

const ICONS = { view: Eye, copy: Copy, edit: Pencil } as const;
const TONES = { view: 'neutral', copy: 'info', edit: 'signal' } as const;

/** What a shared quiz lets you do. Always icon plus text. */
export function AccessBadge({ access, className }: { access: QuizAccess; className?: string }) {
  const Icon = ICONS[access];
  return (
    <Badge tone={TONES[access]} icon={<Icon aria-hidden />} className={className}>
      {ACCESS_LABELS[access]}
    </Badge>
  );
}
