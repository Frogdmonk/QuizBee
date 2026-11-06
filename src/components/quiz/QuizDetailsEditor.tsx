import type { Dispatch } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { Switch, TextAreaField } from '@/components/ui/FormControls';
import { LIMITS } from '@/lib/quiz-rules';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { QuizDraft } from '@/types/quiz';
import { ImagePicker } from './ImagePicker';

export function QuizDetailsEditor({ draft, dispatch }: { draft: QuizDraft; dispatch: Dispatch<EditorAction> }) {
  const titleMissing = draft.title.trim() === '';
  return (
    <Card>
      <CardHeader title="Quiz details" description="Shown in your library and on the lobby screen." />
      <CardBody className="space-y-5">
        <TextField
          label="Title"
          value={draft.title}
          placeholder="e.g. Solar System Basics"
          maxLength={LIMITS.titleMax}
          autoFocus={titleMissing}
          error={titleMissing ? 'Required to save.' : undefined}
          onChange={(e) => dispatch({ type: 'details', patch: { title: e.target.value } })}
        />
        <TextField
          label="Subject or topic"
          value={draft.subject}
          placeholder="e.g. Science · Grade 6"
          maxLength={LIMITS.subjectMax}
          hint="Optional."
          onChange={(e) => dispatch({ type: 'details', patch: { subject: e.target.value } })}
        />
        <TextAreaField
          label="Description"
          value={draft.description}
          placeholder="What is this quiz about?"
          maxChars={LIMITS.descriptionMax}
          rows={3}
          hint="Optional."
          onChange={(e) => dispatch({ type: 'details', patch: { description: e.target.value } })}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-800">
            Cover image <span className="font-normal text-ink-400">(optional)</span>
          </p>
          <ImagePicker
            label="Add cover image"
            value={draft.coverImagePath}
            onChange={(path) => dispatch({ type: 'details', patch: { coverImagePath: path } })}
          />
        </div>
        <div className="rounded-xl border border-ink-100 p-4">
          <Switch
            label="Faster answers score more"
            description="Correct answers earn 50–100% of the points depending on how quickly they arrive. Turn off to award full points for every correct answer."
            checked={draft.speedScoring}
            onChange={(value) => dispatch({ type: 'details', patch: { speedScoring: value } })}
          />
        </div>
      </CardBody>
    </Card>
  );
}
