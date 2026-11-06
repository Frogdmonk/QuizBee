import { Badge } from '@/components/ui/Badge';
import type { QuizStatus } from '@/types/quiz';

const LABELS: Record<QuizStatus, { label: string; tone: 'neutral' | 'success' | 'dark' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  archived: { label: 'Archived', tone: 'dark' },
};

export function StatusBadge({ status }: { status: QuizStatus }) {
  const s = LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
