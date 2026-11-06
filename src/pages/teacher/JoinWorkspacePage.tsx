import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Link2Off } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { StatusBlock } from '@/components/ui/StatusBlock';
import { LowerThird } from '@/components/ui/LowerThird';
import { Monogram } from '@/components/ui/Monogram';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/FormControls';
import { acceptInvite, previewInvite } from '@/services/workspaces';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/utils/errors';
import type { InvitePreview } from '@/types/workspace';

/** /invite/:token — a signed-in teacher reviews and accepts a workspace invite link. */
export default function JoinWorkspacePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewInvite(token)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(friendlyError(e, 'Could not open this invite link. Check your connection and try again.')));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const join = async () => {
    setJoining(true);
    try {
      const workspaceId = await acceptInvite(token);
      toast({ tone: 'success', title: `You joined ${preview?.workspaceName ?? 'the workspace'}` });
      navigate(`/teacher/workspaces/${workspaceId}`, { replace: true });
    } catch (e) {
      toast({ tone: 'error', title: 'Could not join', description: friendlyError(e) });
      setJoining(false);
    }
  };

  return (
    <div className="max-w-[40rem] pt-4 sm:pt-[12vh]">
      {error ? (
        <StatusBlock
          tone="error"
          icon={<Link2Off />}
          title="Invite link not valid"
          actions={
            <ButtonLink to="/teacher/workspaces" variant="secondary">
              Go to Workspaces
            </ButtonLink>
          }
        >
          {error}
        </StatusBlock>
      ) : !preview ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading invite">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-20" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : (
        <div>
          <p className="type-kicker">Invitation</p>
          <LowerThird tab="bg-signal-600" className="mt-4">
            {preview.invitedBy ? `${preview.invitedBy} invited you` : 'A colleague invited you'}
          </LowerThird>
          <div className="mt-6 flex items-center gap-4">
            <Monogram name={preview.workspaceName} seed={preview.workspaceId} size={80} />
            <div className="min-w-0">
              <h1 className="type-display text-display-lg break-words">{preview.workspaceName}</h1>
              <p className="mt-1 text-body-sm text-ink-500">
                <span className="type-score text-score-sm text-ink-900">{preview.memberCount}</span>{' '}
                {preview.memberCount === 1 ? 'member' : 'members'} · Owner: {preview.ownerName}
              </p>
            </div>
          </div>
          {preview.alreadyMember ? (
            <div className="mt-8 space-y-4">
              <Alert tone="info">You are already a member of this workspace.</Alert>
              <ButtonLink to={`/teacher/workspaces/${preview.workspaceId}`} size="lg">
                Open workspace
              </ButtonLink>
            </div>
          ) : (
            <>
              <p className="mt-6 max-w-md text-body text-ink-700">Members see each other&apos;s names and the quizzes shared with the workspace.</p>
              <div className="pb-safe fixed inset-x-0 bottom-[var(--tabbar-h,0px)] z-20 flex gap-3 border-t border-line bg-paper px-4 py-3 sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
                <Button size="lg" className="flex-1 sm:flex-none" loading={joining} onClick={() => void join()}>
                  Join workspace
                </Button>
                <ButtonLink to="/teacher/dashboard" variant="ghost" size="lg">
                  Not now
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
