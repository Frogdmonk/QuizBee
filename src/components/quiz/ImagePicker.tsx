import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media-url';
import { uploadQuizImage } from '@/services/media';
import { useSignedInTeacher } from '@/hooks/useTeacherAuth';
import { useToast } from '@/hooks/useToast';
import { ImageValidationError, ACCEPTED_IMAGE_TYPES } from '@/utils/image';
import { friendlyError } from '@/utils/errors';

type Props = {
  value: string | null;
  onChange: (path: string | null) => void;
  label: string;
  /** Compact square tile (answer images) vs wide banner (question / cover). */
  variant?: 'wide' | 'tile';
  className?: string;
};

/**
 * Pick → compress (WebP, ≤1280 px) → upload to the teacher's storage folder.
 * Removing an image only detaches it from the quiz; the file stays in storage
 * so an unsaved change can still be undone safely.
 */
export function ImagePicker({ value, onChange, label, variant = 'wide', className }: Props) {
  const { user } = useSignedInTeacher();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = mediaUrl(value);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadQuizImage(file, user.id);
      onChange(path);
    } catch (error) {
      const message = error instanceof ImageValidationError ? error.message : friendlyError(error, 'Upload failed. Please try again.');
      toast({ tone: 'error', title: 'Image not added', description: message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const open = () => inputRef.current?.click();
  const tile = variant === 'tile';

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {url ? (
        <div className={cn('group relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50', tile ? 'aspect-square' : 'aspect-[16/9]')}>
          <img src={url} alt="" className={cn('size-full', tile ? 'object-cover' : 'object-contain')} />
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <Spinner label="Uploading image" />
            </div>
          )}
          <div className="absolute right-1.5 bottom-1.5 flex gap-1">
            <button
              type="button"
              onClick={open}
              disabled={uploading}
              className="grid size-8 place-items-center rounded-lg bg-white/95 text-ink-800 shadow-card hover:bg-white"
              aria-label={`Replace ${label.toLowerCase()}`}
              title="Replace"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="grid size-8 place-items-center rounded-lg bg-white/95 text-rose-600 shadow-card hover:bg-white"
              aria-label={`Remove ${label.toLowerCase()}`}
              title="Remove"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-200 text-ink-500',
            'transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800 disabled:opacity-70',
            tile ? 'aspect-square text-xs' : 'py-6 text-sm',
          )}
        >
          {uploading ? <Spinner label="Uploading image" /> : <ImagePlus className={tile ? 'size-5' : 'size-6'} />}
          <span className="font-semibold">{uploading ? 'Uploading…' : label}</span>
          {!tile && !uploading && <span className="text-xs text-ink-400">JPG, PNG, WebP or GIF · up to 10 MB</span>}
        </button>
      )}
    </div>
  );
}
