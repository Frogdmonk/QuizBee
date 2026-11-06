import { Badge } from '@/components/ui/Badge';
import type { QuizStatus } from '@/types/quiz';

const LABELS: Record<QuizStatus, { label: string; tone: 'neutral' | 'mint' | 'dark' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'mint' },
  archived: { label: 'Archived', tone: 'dark' },
};

export function StatusBadge({ status }: { status: QuizStatus }) {
  const s = LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
