import { useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardPaste, Copy, FileJson, Plus, Trash2, X, XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { SelectField, TextAreaField } from '@/components/ui/FormControls';
import { TextField } from '@/components/ui/TextField';
import { CorrectToggle } from './QuestionEditor';
import { CodeAnswerToggle, QuestionCodeField } from '@/components/code/QuestionCodeField';
import { answerStyle } from './answer-styles';
import { useToast } from '@/hooks/useToast';
import { copyText } from '@/utils/clipboard';
import { cn } from '@/lib/cn';
import { DIFFICULTY_LABEL } from '@/lib/learning';
import { LIMITS, QUESTION_TYPE_LABELS, emptyQuiz } from '@/lib/quiz-rules';
import { editorReducer, initEditor, isBlankQuestion, type EditorAction } from '@/lib/quiz-editor-reducer';
import {
  IMPORT_LIMITS,
  MIX_LABELS,
  SAMPLE_JSON,
  buildChatGptPrompt,
  checkImport,
  importReady,
  mixCounts,
  reviewIssues,
  roomError,
  type ImportCheck,
  type ImportMix,
} from '@/lib/quiz-import';
import type { QuestionDraft, QuestionType } from '@/types/quiz';

type Step = 'prompt' | 'paste' | 'review';
const STEPS: { id: Step; title: string }[] = [
  { id: 'prompt', title: 'Generate with ChatGPT' },
  { id: 'paste', title: 'Paste and check JSON' },
  { id: 'review', title: 'Review and import' },
];

export type ImportedQuestions = { questions: QuestionDraft[]; title: string; description: string };

/**
 * "Import questions using ChatGPT": the teacher copies a prompt, runs it in ChatGPT with their
 * presentation, pastes the JSON back, reviews the questions and adds them to the quiz.
 * Nothing here talks to an AI service: the JSON is checked and converted in the browser, and the
 * questions are saved later through the editor's normal save (which the server validates again).
 */
export function ImportQuestionsDialog({
  open,
  onClose,
  existing,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  /** The quiz's current questions: for duplicate checks and the 100-question limit. */
  existing: readonly QuestionDraft[];
  onImport: (result: ImportedQuestions) => void;
}) {
  const [step, setStep] = useState<Step>('prompt');
  const [count, setCount] = useState(10);
  const [mix, setMix] = useState<ImportMix>('mostly_mc');
  const [audience, setAudience] = useState('');
  const [json, setJson] = useState('');
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [review, dispatch] = useReducer(editorReducer, null, () => initEditor({ ...emptyQuiz(), questions: [] }, false));
  const imported = useRef(false);

  // The quiz's starter question doesn't count: an import replaces it.
  const blankStarter = existing.length === 1 && isBlankQuestion(existing[0]);
  const existingCount = blankStarter ? 0 : existing.length;

  const reset = () => {
    setStep('prompt');
    setJson('');
    setCheck(null);
    dispatch({ type: 'load', draft: { ...emptyQuiz(), questions: [] }, saved: false });
  };
  const close = () => {
    onClose();
    // Let the closing animation finish with the content still in place.
    window.setTimeout(reset, 250);
  };

  const startReview = (questions: QuestionDraft[]) => {
    dispatch({ type: 'load', draft: { ...emptyQuiz(), questions }, saved: false });
    imported.current = false;
    setStep('review');
  };

  const reviewQuestions = review.draft.questions;
  const reviewProblems = reviewQuestions.map(reviewIssues);
  const reviewRoom = roomError(reviewQuestions.length, existingCount);
  const canImport = reviewQuestions.length > 0 && reviewProblems.every((p) => p.length === 0) && !reviewRoom;

  const finish = () => {
    // One import per review: a double click can't add the questions twice.
    if (!canImport || imported.current) return;
    imported.current = true;
    onImport({ questions: reviewQuestions, title: check?.title ?? '', description: check?.description ?? '' });
    close();
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      title="Import questions using ChatGPT"
      footer={
        step === 'prompt' ? (
          <Button variant="primary" rightIcon={<ArrowRight className="size-4" />} onClick={() => setStep('paste')}>
            Next: paste the JSON
          </Button>
        ) : step === 'paste' ? (
          <PasteFooter json={json} check={check} existingCount={existingCount} setCheck={setCheck} existing={existing} onBack={() => setStep('prompt')} onReview={startReview} />
        ) : (
          <>
            <Button variant="ghost" leftIcon={<ArrowLeft className="size-4" />} onClick={() => setStep('paste')}>
              Back to the JSON
            </Button>
            <Button variant="primary" leftIcon={<Check className="size-4" />} disabled={!canImport} onClick={finish}>
              {reviewQuestions.length === 1 ? 'Add 1 question to the quiz' : `Add ${reviewQuestions.length} questions to the quiz`}
            </Button>
          </>
        )
      }
    >
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Import progress">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li key={s.id} aria-current={current ? 'step' : undefined} className="min-w-0">
              <span aria-hidden className={cn('block h-1.5', current ? 'bg-signal-600' : done ? 'bg-ink-900' : 'bg-line')} />
              <span className={cn('mt-2 flex items-center gap-1.5 text-caption sm:text-label', current ? 'text-ink-900' : 'text-ink-500')}>
                <span className="type-score text-score-sm">{done ? <Check className="size-3.5" /> : `0${i + 1}`}</span>
                <span className={cn('truncate', !current && 'max-sm:sr-only')}>{s.title}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {step === 'prompt' && <PromptStep count={count} setCount={setCount} mix={mix} setMix={setMix} audience={audience} setAudience={setAudience} />}
      {step === 'paste' && <PasteStep json={json} setJson={setJson} check={check} setCheck={setCheck} existingCount={existingCount} />}
      {step === 'review' && <ReviewStep questions={reviewQuestions} problems={reviewProblems} room={reviewRoom} dispatch={dispatch} />}
    </Dialog>
  );
}

// ── Step 1: the prompt ────────────────────────────────────────────────────────

function PromptStep({
  count,
  setCount,
  mix,
  setMix,
  audience,
  setAudience,
}: {
  count: number;
  setCount: (n: number) => void;
  mix: ImportMix;
  setMix: (m: ImportMix) => void;
  audience: string;
  setAudience: (s: string) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => buildChatGptPrompt({ count, mix, audience }), [count, mix, audience]);
  const { mc, tf } = mixCounts(count, mix);

  const copy = async () => {
    if (await copyText(prompt)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } else {
      toast({ tone: 'error', title: 'Could not copy', description: 'Select the prompt below and copy it with Ctrl+C (or ⌘C).' });
    }
  };

  return (
    <div className="space-y-6">
      <ol className="space-y-1.5 text-body-sm text-ink-700">
        {[
          'Upload your PowerPoint presentation (PPT or PPTX) to ChatGPT.',
          'Copy the prompt below.',
          'Paste the prompt into ChatGPT along with your presentation.',
          'ChatGPT analyses the presentation and writes the questions as JSON.',
          'Copy ChatGPT’s complete answer.',
          'Come back here and paste it in the next step.',
          'Review the questions, then add them to your quiz.',
        ].map((line, i) => (
          <li key={line} className="flex gap-3">
            <span className="type-score w-5 shrink-0 text-score-sm text-ink-500">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Number of questions" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {IMPORT_LIMITS.promptCounts.map((n) => (
            <option key={n} value={n}>
              {n} questions
            </option>
          ))}
        </SelectField>
        <SelectField label="Question types" value={mix} onChange={(e) => setMix(e.target.value as ImportMix)}>
          {(Object.keys(MIX_LABELS) as ImportMix[]).map((m) => (
            <option key={m} value={m}>
              {MIX_LABELS[m]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Students"
          optional
          placeholder="e.g. Grade 8 science"
          value={audience}
          maxLength={IMPORT_LIMITS.audienceMax}
          onChange={(e) => setAudience(e.target.value)}
        />
      </div>
      <p className="-mt-3 text-caption text-ink-500">
        ChatGPT will be asked for {mc > 0 && `${mc} multiple choice`}
        {mc > 0 && tf > 0 && ' and '}
        {tf > 0 && `${tf} true/false`}.
      </p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-label text-ink-900">Prompt for ChatGPT</p>
          <Button variant="primary" size="lg" leftIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void copy()}>
            {copied ? 'Prompt copied' : 'Copy ChatGPT prompt'}
          </Button>
        </div>
        <pre
          tabIndex={0}
          aria-label="Prompt for ChatGPT"
          className="max-h-64 overflow-auto rounded-sm border border-line bg-paper px-4 py-3 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-ink-900"
        >
          {prompt}
        </pre>
      </div>

      <p className="text-caption text-ink-500">
        NIAT ARENA never sends your presentation or your quiz to ChatGPT or any other AI service. You run the prompt in ChatGPT yourself; NIAT ARENA only reads the JSON you paste back.
      </p>
    </div>
  );
}

// ── Step 2: paste and check ───────────────────────────────────────────────────

function PasteStep({
  json,
  setJson,
  check,
  setCheck,
  existingCount,
}: {
  json: string;
  setJson: (s: string) => void;
  check: ImportCheck | null;
  setCheck: (c: ImportCheck | null) => void;
  existingCount: number;
}) {
  const { toast } = useToast();
  const update = (value: string) => {
    setJson(value);
    setCheck(null); // a changed text must be checked again
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error('empty');
      update(text);
    } catch {
      toast({ tone: 'info', title: 'Paste with the keyboard', description: 'Click in the box and press Ctrl+V (or ⌘V).' });
    }
  };

  const valid = check?.items.filter((i) => i.errors.length === 0).length ?? 0;
  const invalid = (check?.items.length ?? 0) - valid;
  const room = check && check.fatal.length === 0 ? roomError(check.items.length, existingCount) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" leftIcon={<ClipboardPaste className="size-4" />} onClick={() => void paste()}>
          Paste JSON
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<FileJson className="size-4" />} onClick={() => update(SAMPLE_JSON)}>
          Use sample JSON
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<X className="size-4" />} onClick={() => update('')} disabled={!json}>
          Clear
        </Button>
      </div>

      <TextAreaField
        label="JSON from ChatGPT"
        value={json}
        onChange={(e) => update(e.target.value)}
        rows={14}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={'{\n  "quiz_title": "…",\n  "questions": [ … ]\n}'}
        className="[&_textarea]:font-mono [&_textarea]:text-[0.8125rem] [&_textarea]:leading-relaxed"
        hint={json.length > IMPORT_LIMITS.maxChars ? undefined : `${json.length.toLocaleString('en')} characters`}
        error={json.length > IMPORT_LIMITS.maxChars ? 'This is too long to be one quiz.' : undefined}
      />

      {check && (
        <div className="space-y-3" aria-live="polite">
          {check.notes.map((note) => (
            <Alert key={note} tone="info">
              {note}
            </Alert>
          ))}
          {check.fatal.map((message) => (
            <Alert key={message} tone="error" title="NIAT ARENA could not read this JSON">
              {message}
            </Alert>
          ))}
          {check.quizErrors.length > 0 && (
            <Alert tone="error" title="Fix the quiz details">
              <ul className="list-disc pl-5">
                {check.quizErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
          {room && <Alert tone="error">{room}</Alert>}
          {check.items.length > 0 &&
            (invalid === 0 && check.quizErrors.length === 0 && !room ? (
              <Alert tone="success" title={`All ${check.items.length} questions are valid`}>
                Review them in the next step before they are added to your quiz.
              </Alert>
            ) : (
              invalid > 0 && (
                <Alert tone="warning" title={`${invalid} of ${check.items.length} questions need fixing`}>
                  Correct them in the JSON above (or ask ChatGPT to fix them), then validate again. Nothing has been removed.
                </Alert>
              )
            ))}
          {check.items.length > 0 && (
            <ol className="divide-y divide-line rounded-sm border border-line">
              {check.items.map((item) => (
                <li key={item.number} className="flex gap-3 px-3 py-2.5">
                  {item.errors.length === 0 ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" aria-label="Valid" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-error-600" aria-label="Needs fixing" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm">
                      <span className="font-semibold">Question {item.number}:</span> <span className={cn(item.label === 'Untitled question' && 'text-ink-500 italic')}>{item.label}</span>
                    </p>
                    {item.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-body-sm text-error-600">
                        {item.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function PasteFooter({
  json,
  check,
  setCheck,
  existingCount,
  existing,
  onBack,
  onReview,
}: {
  json: string;
  check: ImportCheck | null;
  setCheck: (c: ImportCheck | null) => void;
  existingCount: number;
  existing: readonly QuestionDraft[];
  onBack: () => void;
  onReview: (questions: QuestionDraft[]) => void;
}) {
  const validItems = check?.items.filter((i) => i.draft) ?? [];
  const ready = check !== null && importReady(check) && !roomError(check.items.length, existingCount);
  // Some questions are fine and some are not: the teacher may choose to continue with the good ones.
  const partial =
    check !== null && !ready && check.fatal.length === 0 && check.quizErrors.length === 0 && validItems.length > 0 && !roomError(validItems.length, existingCount);
  return (
    <>
      <Button variant="ghost" leftIcon={<ArrowLeft className="size-4" />} onClick={onBack}>
        Back
      </Button>
      {partial && (
        <Button variant="secondary" onClick={() => onReview(validItems.map((i) => i.draft!))}>
          {validItems.length === 1 ? 'Review the 1 valid question only' : `Review the ${validItems.length} valid questions only`}
        </Button>
      )}
      <Button variant={ready ? 'secondary' : 'primary'} disabled={!json.trim()} onClick={() => setCheck(checkImport(json, { existing }))}>
        Validate JSON
      </Button>
      <Button variant="primary" rightIcon={<ArrowRight className="size-4" />} disabled={!ready} onClick={() => check && onReview(check.items.map((i) => i.draft!))}>
        Review questions
      </Button>
    </>
  );
}

// ── Step 3: review and edit ───────────────────────────────────────────────────

function ReviewStep({
  questions,
  problems,
  room,
  dispatch,
}: {
  questions: QuestionDraft[];
  problems: string[][];
  room: string | null;
  dispatch: Dispatch<EditorAction>;
}) {
  const needWork = problems.filter((p) => p.length > 0).length;
  if (questions.length === 0) {
    return <Alert tone="info">Every question was deleted. Go back to the JSON to start again.</Alert>;
  }
  return (
    <div className="space-y-4">
      <p className="text-body-sm text-ink-700">
        Check every question. You can edit, reorder or delete them here, and keep editing after they are added. The quiz is not saved or published until you choose to.
      </p>
      {room && <Alert tone="error">{room}</Alert>}
      {needWork > 0 && (
        <Alert tone="warning">
          {needWork === 1 ? '1 question needs' : `${needWork} questions need`} attention before you can add them.
        </Alert>
      )}
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <ReviewCard key={q.key} question={q} index={i} total={questions.length} issues={problems[i]} dispatch={dispatch} />
        ))}
      </ol>
    </div>
  );
}

const IMPORT_TYPES: QuestionType[] = ['multiple_choice', 'true_false'];

function ReviewCard({
  question: q,
  index,
  total,
  issues,
  dispatch,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  issues: string[];
  dispatch: Dispatch<EditorAction>;
}) {
  const trueFalse = q.type === 'true_false';
  const n = index + 1;
  return (
    <li className={cn('space-y-3 rounded-sm border bg-surface p-4', issues.length ? 'border-answer-d' : 'border-line')} aria-label={`Question ${n}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-score text-score-sm text-ink-500">{String(n).padStart(2, '0')}</span>
        <SelectField
          label={`Question ${n} type`}
          hideLabel
          value={q.type}
          className="w-44"
          onChange={(e) => dispatch({ type: 'changeType', key: q.key, questionType: e.target.value as QuestionType })}
        >
          {IMPORT_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        {q.difficulty && <Badge tone="neutral">{DIFFICULTY_LABEL[q.difficulty]}</Badge>}
        {q.topic && <Badge tone="info">{q.topic}</Badge>}
        <span className="ml-auto flex items-center">
          <IconButton label={`Move question ${n} up`} disabled={index === 0} onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: -1 })}>
            <ArrowDown className="size-4 rotate-180" />
          </IconButton>
          <IconButton label={`Move question ${n} down`} disabled={index === total - 1} onClick={() => dispatch({ type: 'moveQuestion', key: q.key, delta: 1 })}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label={`Delete question ${n}`} danger onClick={() => dispatch({ type: 'removeQuestion', key: q.key })}>
            <Trash2 className="size-4" />
          </IconButton>
        </span>
      </div>

      <TextAreaField
        label="Question"
        rows={2}
        value={q.prompt}
        maxChars={LIMITS.promptMax}
        onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { prompt: e.target.value } })}
        className="[&_textarea]:min-h-0"
      />

      <QuestionCodeField question={q} dispatch={dispatch} label={`Question ${n} code`} />

      <fieldset className="space-y-2">
        <legend className="text-label text-ink-900">
          Answers <span className="font-normal text-ink-500">· tick the correct one</span>
        </legend>
        <div role="radiogroup" aria-label={`Question ${n} correct answer`} className="grid gap-2 sm:grid-cols-2">
          {q.options.map((option, j) => {
            const style = answerStyle(j);
            return (
              <div
                key={option.key}
                className={cn(
                  'relative flex min-w-0 items-center gap-2 overflow-hidden rounded-sm border py-1.5 pr-1.5 pl-4',
                  option.isCorrect ? 'border-success-600 bg-success-50' : ['border-line', style.softBg],
                )}
              >
                <span aria-hidden className={cn('absolute inset-y-0 left-0 w-2.5', style.kit)} />
                <span className={cn('type-stage grid size-8 shrink-0 place-items-center rounded-[4px] text-[1rem]', style.bg, style.fg)}>{style.letter}</span>
                <input
                  type="text"
                  value={option.label}
                  readOnly={trueFalse}
                  aria-label={`Question ${n} answer ${style.letter}`}
                  placeholder={`Answer ${style.letter}`}
                  onChange={(e) => dispatch({ type: 'updateOption', questionKey: q.key, optionKey: option.key, patch: { label: e.target.value } })}
                  className={cn('h-10 min-w-0 flex-1 rounded-xs border border-transparent bg-transparent px-2 text-body outline-none read-only:cursor-default focus:border-line-strong focus:bg-surface', option.isCode && 'font-mono text-body-sm')}
                />
                {!trueFalse && (
                  <CodeAnswerToggle
                    option={option}
                    letter={style.letter}
                    onToggle={() => dispatch({ type: 'updateOption', questionKey: q.key, optionKey: option.key, patch: { isCode: !option.isCode } })}
                  />
                )}
                <CorrectToggle checked={option.isCorrect} letter={style.letter} onSelect={() => dispatch({ type: 'setCorrect', questionKey: q.key, optionKey: option.key })} />
                {!trueFalse && q.options.length > LIMITS.minOptions && (
                  <IconButton label={`Remove answer ${style.letter} from question ${n}`} danger onClick={() => dispatch({ type: 'removeOption', questionKey: q.key, optionKey: option.key })}>
                    <X className="size-4" />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>
        {!trueFalse && q.options.length < LIMITS.maxOptions && (
          <Button variant="ghost" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => dispatch({ type: 'addOption', questionKey: q.key })}>
            Add answer
          </Button>
        )}
      </fieldset>

      <TextAreaField
        label="Explanation"
        rows={2}
        value={q.explanation}
        maxChars={LIMITS.explanationMax}
        onChange={(e) => dispatch({ type: 'updateQuestion', key: q.key, patch: { explanation: e.target.value } })}
        className="[&_textarea]:min-h-0"
      />

      {issues.length > 0 && <p className="text-body-sm font-semibold text-warning-700">{issues.join(' ')}</p>}
    </li>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-paper-sunk disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-11',
        danger ? 'hover:text-error-600' : 'hover:text-ink-900',
      )}
    >
      {children}
    </button>
  );
}
