import { ImageIcon, ListChecks, ToggleLeft, type LucideIcon } from 'lucide-react';
import type { QuestionType } from '@/types/quiz';

export const QUESTION_TYPE_ICONS: Record<QuestionType, LucideIcon> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  image_choice: ImageIcon,
};
