import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Link2Off, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
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
    <div className="mx-auto max-w-lg py-4 sm:py-10">
      <Card>
        <CardBody className="px-6 py-8 text-center sm:px-8">
          {error ? (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <Link2Off className="size-7" />
              </span>
              <h1 className="mt-5 text-2xl font-extrabold">Invite link not valid</h1>
              <p className="mt-2 text-ink-600">{error}</p>
              <ButtonLink to="/teacher/workspaces" variant="secondary" className="mt-6">
                Go to Workspaces
              </ButtonLink>
            </>
          ) : !preview ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading invite">
              <Skeleton className="mx-auto size-14 rounded-2xl" />
              <Skeleton className="mx-auto h-8 w-2/3" />
              <Skeleton className="mx-auto h-5 w-1/2" />
            </div>
          ) : (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-flame-50 text-flame-600">
                <Users className="size-7" />
              </span>
              <p className="mt-5 text-sm font-semibold text-ink-500">
                {preview.invitedBy} invited you to join
              </p>
              <h1 className="mt-1 text-3xl font-extrabold break-words">{preview.workspaceName}</h1>
              <p className="mt-2 text-ink-600">
                {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'} · Owner: {preview.ownerName}
              </p>
              {preview.alreadyMember ? (
                <>
                  <p className="mt-6 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">You are already a member of this workspace.</p>
                  <ButtonLink to={`/teacher/workspaces/${preview.workspaceId}`} className="mt-5" fullWidth size="lg">
                    Open workspace
                  </ButtonLink>
                </>
              ) : (
                <>
                  <p className="mt-6 text-sm text-ink-500">
                    Members see each other&apos;s names and the quizzes shared with the workspace.
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <Button size="lg" fullWidth loading={joining} onClick={() => void join()}>
                      Join workspace
                    </Button>
                    <ButtonLink to="/teacher/dashboard" variant="ghost" fullWidth>
                      Not now
                    </ButtonLink>
                  </div>
                </>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
