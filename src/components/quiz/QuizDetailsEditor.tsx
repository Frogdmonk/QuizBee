import { useState, type Dispatch, type ReactNode } from 'react';
import { TextField } from '@/components/ui/TextField';
import { Switch, TextAreaField } from '@/components/ui/FormControls';
import { LIMITS } from '@/lib/quiz-rules';
import type { EditorAction } from '@/lib/quiz-editor-reducer';
import type { QuizDraft } from '@/types/quiz';
import { ImagePicker } from './ImagePicker';

function Row({ children }: { children: ReactNode }) {
  return <div className="border-t border-line py-5 first:border-t-0 first:pt-0">{children}</div>;
}

/** Quiz details in one sheet, sections divided by hairlines. */
export function QuizDetailsEditor({ draft, dispatch }: { draft: QuizDraft; dispatch: Dispatch<EditorAction> }) {
  const titleMissing = draft.title.trim() === '';
  // Validate on blur, not while a brand-new quiz is still empty.
  const [titleTouched, setTitleTouched] = useState(false);
  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <p className="type-kicker">Quiz details</p>
        <p className="mt-1 text-body-sm text-ink-500">Shown in your library and on the lobby screen.</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <Row>
          <TextField
            label="Title"
            value={draft.title}
            placeholder="e.g. Solar System Basics"
            maxLength={LIMITS.titleMax}
            autoFocus={titleMissing}
            hint={titleMissing && !titleTouched ? 'Name your quiz to save it.' : undefined}
            error={titleMissing && titleTouched ? 'Required to save.' : undefined}
            onBlur={() => setTitleTouched(true)}
            onChange={(e) => dispatch({ type: 'details', patch: { title: e.target.value } })}
          />
        </Row>
        <Row>
          <TextField
            label="Subject or topic"
            value={draft.subject}
            placeholder="e.g. Science · Grade 6"
            maxLength={LIMITS.subjectMax}
            optional
            onChange={(e) => dispatch({ type: 'details', patch: { subject: e.target.value } })}
          />
        </Row>
        <Row>
          <TextAreaField
            label="Description"
            value={draft.description}
            placeholder="What is this quiz about?"
            maxChars={LIMITS.descriptionMax}
            rows={3}
            optional
            onChange={(e) => dispatch({ type: 'details', patch: { description: e.target.value } })}
          />
        </Row>
        <Row>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-label text-ink-900">Cover image</p>
              <span className="text-caption text-ink-500">Optional</span>
            </div>
            <ImagePicker
              label="Add cover image"
              value={draft.coverImagePath}
              onChange={(path) => dispatch({ type: 'details', patch: { coverImagePath: path } })}
            />
          </div>
        </Row>
        <Row>
          <Switch
            label="Faster answers score more"
            description="Correct answers earn 50–100% of the points depending on how quickly they arrive. Turn off to award full points for every correct answer."
            checked={draft.speedScoring}
            onChange={(value) => dispatch({ type: 'details', patch: { speedScoring: value } })}
          />
        </Row>
      </div>
    </div>
  );
}
