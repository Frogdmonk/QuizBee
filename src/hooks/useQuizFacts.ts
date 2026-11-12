import { useEffect, useState } from 'react';
import { getQuizDraft } from '@/services/quizzes';

export type QuizFacts = {
  /** Learning objectives and topics of the quiz's questions (the monster's weakness is chosen from these). */
  topics: string[];
  /** Each question's difficulty, or null where it is not tagged (for the automatic difficulty preview). */
  difficulties: (string | null)[];
  loaded: boolean;
};

const EMPTY: QuizFacts = { topics: [], difficulties: [], loaded: false };

/**
 * What the host lobby needs to know about the session's quiz. Read once; if it cannot be read
 * (deleted, or no longer shared), the lobby works without it: no weakness topic, automatic = medium.
 */
export function useQuizFacts(quizId: string | null | undefined): QuizFacts {
  const [facts, setFacts] = useState<QuizFacts & { id: string | null }>({ ...EMPTY, id: null });
  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    getQuizDraft(quizId)
      .then((quiz) => {
        if (cancelled) return;
        const topics = new Set<string>();
        for (const q of quiz.questions) {
          if (q.objective.trim()) topics.add(q.objective.trim());
          if (q.topic.trim()) topics.add(q.topic.trim());
        }
        setFacts({ id: quizId, topics: [...topics], difficulties: quiz.questions.map((q) => q.difficulty), loaded: true });
      })
      .catch(() => {
        if (!cancelled) setFacts({ ...EMPTY, id: quizId, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);
  return facts.id === quizId ? facts : { ...EMPTY, loaded: !quizId };
}
