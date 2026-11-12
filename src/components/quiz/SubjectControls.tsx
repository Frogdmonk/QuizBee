import { useState } from 'react';
import { CheckSquare, FolderInput, FolderMinus, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/lib/cn';
import { SUBJECT_NAME_MAX, type Subject } from '@/services/subjects';

/** Which quizzes the library shows: every quiz, the unfiled ones, or one subject's. */
export type Folder = 'all' | 'none' | string;

/** The subjects as chips: All, each subject (with its count and whether it is shared), Not in a subject. */
export function SubjectBar({
  subjects,
  folder,
  onFolder,
  total,
  unfiled,
  onNew,
}: {
  subjects: readonly Subject[];
  folder: Folder;
  onFolder: (f: Folder) => void;
  total: number;
  unfiled: number;
  onNew: () => void;
}) {
  const chip = (value: Folder, label: string, count: number, shared = false) => (
    <button
      key={value}
      type="button"
      aria-pressed={folder === value}
      onClick={() => onFolder(value)}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-label whitespace-nowrap transition-colors duration-[var(--dur-fast)]',
        folder === value ? 'border-ink-900 bg-ink-900 text-white' : 'border-line-strong bg-surface text-ink-700 hover:text-ink-900',
      )}
    >
      {value !== 'all' && value !== 'none' && <FolderOpen className="size-4" aria-hidden />}
      {label}
      <span className={cn('tabular text-caption', folder === value ? 'text-white/75' : 'text-ink-500')}>{count}</span>
      {shared && <Users className="size-3.5" aria-label="Shared" />}
    </button>
  );
  return (
    <nav aria-label="Subjects" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {chip('all', 'All quizzes', total)}
      {subjects.map((s) => chip(s.id, s.name, s.quizCount, s.shared))}
      {subjects.length > 0 && chip('none', 'Not in a subject', unfiled)}
      <button
        type="button"
        onClick={onNew}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-dashed border-line-strong px-4 text-label whitespace-nowrap text-ink-700 hover:bg-surface hover:text-ink-900"
      >
        <FolderPlus className="size-4" /> New subject
      </button>
    </nav>
  );
}

/** The open subject's name and what the owner can do with it. */
export function SubjectHeader({ subject, onShare, onRename, onDelete }: { subject: Subject; onShare: () => void; onRename: () => void; onDelete: () => void }) {
  const items: MenuItem[] = [
    { label: 'Rename', icon: <Pencil />, onSelect: onRename },
    { label: 'Delete subject', icon: <Trash2 />, onSelect: onDelete, tone: 'danger' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-title">
          <FolderOpen className="size-5 shrink-0 text-ink-500" aria-hidden />
          <span className="truncate">{subject.name}</span>
        </p>
        <p className="mt-0.5 text-caption text-ink-500">
          {subject.quizCount} {subject.quizCount === 1 ? 'quiz' : 'quizzes'}
          {subject.shared ? ' · shared: everyone you shared it with sees every quiz in it' : ' · only you'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" leftIcon={<Users className="size-4" />} onClick={onShare}>
          Share subject
        </Button>
        <Menu label={`More for ${subject.name}`} trigger={<MoreHorizontal className="size-5" />} items={items} />
      </div>
    </div>
  );
}

/** Naming a new subject, or renaming one. */
export function SubjectNameDialog({
  open,
  title,
  initial = '',
  confirmLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initial);
      setError(null);
    }
  }
  const submit = async () => {
    const clean = name.trim();
    if (!clean) return setError('Give the subject a name.');
    if (clean.length > SUBJECT_NAME_MAX) return setError(`At most ${SUBJECT_NAME_MAX} characters.`);
    setBusy(true);
    try {
      await onSubmit(clean);
    } catch (e) {
      setError((e as Error).message || 'Could not save the subject.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Subject name"
          value={name}
          maxLength={SUBJECT_NAME_MAX + 10}
          placeholder="e.g. Physics, Year 9"
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
          hint="A folder for your quizzes. Share it to share every quiz inside."
          data-autofocus
        />
      </form>
    </Dialog>
  );
}

/** Shown while choosing quizzes: how many, and where to put them. */
export function SelectionBar({
  count,
  subjects,
  canRemove,
  busy,
  onMove,
  onNewAndMove,
  onRemove,
  onSelectAll,
  onDone,
}: {
  count: number;
  subjects: readonly Subject[];
  canRemove: boolean;
  busy: boolean;
  onMove: (subjectId: string) => void;
  onNewAndMove: () => void;
  onRemove: () => void;
  onSelectAll: () => void;
  onDone: () => void;
}) {
  const items: MenuItem[] = [
    ...subjects.map((s) => ({ label: s.name, icon: <FolderOpen />, onSelect: () => onMove(s.id) })),
    ...(subjects.length ? (['separator'] as MenuItem[]) : []),
    { label: 'New subject…', icon: <FolderPlus />, onSelect: onNewAndMove },
  ];
  return (
    <div
      role="region"
      aria-label="Selected quizzes"
      className="sticky bottom-[calc(var(--tabbar-h,0px)+env(safe-area-inset-bottom)+0.75rem)] z-30 flex flex-wrap items-center gap-2 rounded-md border border-ink-900 bg-ink-900 px-4 py-3 text-white shadow-pop sm:bottom-4"
    >
      <p className="mr-auto text-label">
        <span className="tabular">{count}</span> selected
      </p>
      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" leftIcon={<CheckSquare className="size-4" />} onClick={onSelectAll}>
        Select all
      </Button>
      {count > 0 && (
        <>
          <Menu
            label="Move to subject"
            align="right"
            plainTrigger
            triggerClassName="inline-flex h-9 items-center gap-2 rounded-sm bg-white px-3 text-body-sm font-semibold text-ink-900 hover:bg-paper disabled:opacity-60 pointer-coarse:h-11"
            trigger={
              <>
                <FolderInput className="size-4" /> {busy ? 'Moving…' : 'Move to subject'}
              </>
            }
            items={items}
          />
          {canRemove && (
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" leftIcon={<FolderMinus className="size-4" />} onClick={onRemove} disabled={busy}>
              Take out of subject
            </Button>
          )}
        </>
      )}
      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" leftIcon={<X className="size-4" />} onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
