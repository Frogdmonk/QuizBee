import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { AvatarBuilder } from '@/components/avatar/AvatarBuilder';
import { AVATAR_PRESETS, isAvatarCode } from '@/lib/avatar';
import { NICKNAME_MAX, nicknameIssue, cleanNickname } from '@/lib/nickname-rules';
import { isValidPin, sanitizePin } from '@/lib/session-rules';
import { ensurePlayerSession, joinSession, loadPlayerProfile, lookupSession, savePlayerProfile } from '@/services/player';
import { friendlyError } from '@/utils/errors';

type Found = { sessionId: string; quizTitle: string };

function startingProfile() {
  const saved = loadPlayerProfile();
  return {
    nickname: saved?.nickname ?? '',
    avatar: saved && isAvatarCode(saved.avatar) ? saved.avatar : AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)].code,
  };
}

/** /join and /join/:pin: enter the PIN, then pick a nickname and avatar. */
export default function JoinPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [pin, setPin] = useState(() => sanitizePin(params.pin ?? ''));
  const [found, setFound] = useState<Found | null>(null);
  const [checking, setChecking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [profile, setProfile] = useState(startingProfile);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const autoChecked = useRef(false);

  const check = useCallback(
    async (value: string) => {
      if (!isValidPin(value)) {
        setPinError('Enter the 6-digit game PIN from the big screen.');
        return;
      }
      setChecking(true);
      setPinError(null);
      try {
        await ensurePlayerSession();
        const result = await lookupSession(value);
        if (!result.found) {
          setPinError('No open game has that PIN. Check the big screen and try again.');
        } else if (result.me?.status === 'active') {
          navigate(`/game/${result.sessionId}`, { replace: true });
          return;
        } else if (result.me?.status === 'removed') {
          setPinError('The host removed you from this game.');
        } else if (result.status !== 'lobby') {
          setPinError('This game has already started.');
        } else if (result.isLocked) {
          setPinError('The host has locked this game. Ask them to unlock it.');
        } else if (result.isFull) {
          setPinError('This game is full.');
        } else {
          if (result.me) {
            const me = result.me;
            setProfile((p) => ({ nickname: p.nickname || me.nickname, avatar: me.avatar }));
          }
          setFound({ sessionId: result.sessionId, quizTitle: result.quizTitle });
        }
      } catch (error) {
        setPinError(friendlyError(error));
      } finally {
        setChecking(false);
      }
    },
    [navigate],
  );

  // A QR code opens /join/123456: check it straight away.
  useEffect(() => {
    if (autoChecked.current || !isValidPin(pin) || !params.pin) return;
    autoChecked.current = true;
    void check(pin);
  }, [check, pin, params.pin]);

  const submitPin = (e: FormEvent) => {
    e.preventDefault();
    void check(pin);
  };

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!found) return;
    const issue = nicknameIssue(profile.nickname);
    if (issue) {
      setNicknameError(issue);
      return;
    }
    setJoining(true);
    setNicknameError(null);
    try {
      const nickname = cleanNickname(profile.nickname);
      await joinSession(found.sessionId, nickname, profile.avatar);
      savePlayerProfile({ nickname, avatar: profile.avatar });
      navigate(`/game/${found.sessionId}`, { replace: true });
    } catch (error) {
      setNicknameError(friendlyError(error));
      setJoining(false);
    }
  };

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-night-900 px-5 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col py-6">
        <Link to="/" aria-label="Home" className="self-start">
          <Logo inverted />
        </Link>

        <AnimatePresence mode="wait" initial={false}>
          {!found ? (
            <m.form
              key="pin"
              onSubmit={submitPin}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="flex flex-1 flex-col justify-center gap-5 py-10"
              noValidate
            >
              <div>
                <h1 className="text-3xl font-extrabold">Join a game</h1>
                <p className="mt-2 text-white/70">Type the PIN shown on the big screen.</p>
              </div>
              <label className="block">
                <span className="sr-only">Game PIN</span>
                <input
                  value={pin}
                  onChange={(e) => {
                    setPin(sanitizePin(e.target.value));
                    setPinError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="go"
                  placeholder="000000"
                  maxLength={6}
                  aria-invalid={pinError ? true : undefined}
                  aria-describedby={pinError ? 'pin-error' : undefined}
                  className="h-20 w-full rounded-2xl border-2 border-white/15 bg-white/6 text-center font-display text-5xl font-extrabold tracking-[0.25em] text-white tabular outline-none placeholder:text-white/20 focus:border-flame-400"
                  autoFocus
                />
              </label>
              {pinError && (
                <p id="pin-error" role="alert" className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200">
                  {pinError}
                </p>
              )}
              <Button type="submit" size="xl" fullWidth loading={checking} disabled={pin.length !== 6} rightIcon={<ArrowRight className="size-5" />}>
                Enter
              </Button>
            </m.form>
          ) : (
            <m.form
              key="profile"
              onSubmit={(e) => void submitProfile(e)}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="flex flex-1 flex-col gap-5 py-6"
              noValidate
            >
              <div>
                <button
                  type="button"
                  onClick={() => setFound(null)}
                  className="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-white/60 hover:text-white"
                >
                  <ArrowLeft className="size-4" /> Different PIN
                </button>
                <p className="mt-3 truncate text-sm font-bold tracking-wide text-flame-300 uppercase">{found.quizTitle}</p>
                <h1 className="text-3xl font-extrabold">Who’s playing?</h1>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-white/80">Nickname</span>
                <input
                  value={profile.nickname}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, nickname: e.target.value }));
                    setNicknameError(null);
                  }}
                  maxLength={NICKNAME_MAX + 8}
                  autoComplete="nickname"
                  enterKeyHint="done"
                  placeholder="e.g. Sam R"
                  aria-invalid={nicknameError ? true : undefined}
                  aria-describedby={nicknameError ? 'nickname-error' : 'nickname-hint'}
                  className="h-14 w-full rounded-xl border-2 border-white/15 bg-white/6 px-4 text-xl font-bold text-white outline-none placeholder:font-normal placeholder:text-white/30 focus:border-flame-400"
                />
                {nicknameError ? (
                  <p id="nickname-error" role="alert" className="mt-2 text-sm font-semibold text-rose-300">
                    {nicknameError}
                  </p>
                ) : (
                  <p id="nickname-hint" className="mt-2 text-sm text-white/50">
                    2–16 characters. Your teacher sees this name.
                  </p>
                )}
              </label>

              <AvatarBuilder value={profile.avatar} onChange={(avatar) => setProfile((p) => ({ ...p, avatar }))} dark />

              <div className="sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-night-900 via-night-900 to-night-900/0 px-5 pt-6 pb-2">
                <Button type="submit" size="xl" fullWidth loading={joining}>
                  Join game
                </Button>
              </div>
            </m.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
