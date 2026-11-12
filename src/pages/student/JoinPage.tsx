import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { NightCanvas } from '@/components/ui/NightCanvas';
import { PinDigits } from '@/components/ui/PinDigits';
import { LowerThird } from '@/components/ui/LowerThird';
import { ScoreBug } from '@/components/ui/ScoreBug';
import { TextField } from '@/components/ui/TextField';
import { AvatarBuilder } from '@/components/avatar/AvatarBuilder';
import { AvatarHero } from '@/components/avatar/AvatarHero';
import { AVATAR_PRESETS, isAvatarCode } from '@/lib/avatar';
import { NICKNAME_MAX, nicknameIssue, cleanNickname } from '@/lib/nickname-rules';
import { isValidPin, sanitizePin } from '@/lib/session-rules';
import { dur, stepSlide } from '@/lib/motion';
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
  const [errorNudge, setErrorNudge] = useState(0);
  const [pinFocused, setPinFocused] = useState(false);
  const [profile, setProfile] = useState(startingProfile);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const autoChecked = useRef(false);

  const fail = (message: string) => {
    setPinError(message);
    setErrorNudge((n) => n + 1);
  };

  const check = useCallback(
    async (value: string) => {
      if (!isValidPin(value)) {
        setPinError('Enter the 6-digit game PIN from the big screen.');
        setErrorNudge((n) => n + 1);
        return;
      }
      setChecking(true);
      setPinError(null);
      try {
        await ensurePlayerSession();
        const result = await lookupSession(value);
        if (!result.found) {
          fail('No open game has that PIN. Check the big screen and try again.');
        } else if (result.me?.status === 'active') {
          navigate(`/game/${result.sessionId}`, { replace: true });
          return;
        } else if (result.me?.status === 'removed') {
          fail('The host removed you from this game.');
        } else if (result.isLocked) {
          fail('The host has locked this game. Ask them to unlock it.');
        } else if (result.isFull) {
          fail('This game is full.');
        } else {
          if (result.me) {
            const me = result.me;
            setProfile((p) => ({ nickname: p.nickname || me.nickname, avatar: me.avatar }));
          }
          setFound({ sessionId: result.sessionId, quizTitle: result.quizTitle });
        }
      } catch (error) {
        fail(friendlyError(error));
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

  const complete = pin.length === 6;
  const step = found ? 'profile' : 'pin';
  const nicknameLength = [...cleanNickname(profile.nickname)].length;

  return (
    <NightCanvas>
      {/* Step bar: a non-blocking cue that the flow moved on. */}
      <m.span
        key={step}
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 block h-[3px] origin-left bg-signal-400"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ scaleX: { duration: dur.base }, opacity: { delay: 0.5, duration: dur.base } }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === 'pin' ? (
          <m.div key="pin" variants={stepSlide(-1)} initial="hidden" animate="show" exit="exit" className="mx-auto grid min-h-dvh w-full max-w-6xl lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <form onSubmit={submitPin} noValidate className="flex min-h-dvh flex-col px-5 pt-5 pb-4 sm:px-10">
              <LogoMark tone="night" className="size-9" />
              <div className="pt-[12vh]">
                <p className="type-kicker">Game PIN</p>
                <h1 className="type-display mt-2 text-display-lg">Join a game</h1>
                <p className="mt-3 text-body text-night-muted">Type the PIN from the big screen.</p>

                <m.div
                  key={errorNudge}
                  className="relative mt-8"
                  animate={errorNudge ? { x: [0, -6, 6, -6, 6, 0] } : undefined}
                  transition={{ duration: 0.36 }}
                >
                  <PinDigits value={pin} size="phone" activeIndex={pinFocused && !complete ? pin.length : undefined} className="w-full justify-between" />
                  <label className="absolute inset-0">
                    <span className="sr-only">Game PIN, 6 digits</span>
                    <input
                      value={pin}
                      onChange={(e) => {
                        setPin(sanitizePin(e.target.value));
                        setPinError(null);
                      }}
                      onFocus={() => setPinFocused(true)}
                      onBlur={() => setPinFocused(false)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      enterKeyHint="go"
                      maxLength={6}
                      aria-invalid={pinError ? true : undefined}
                      aria-describedby={pinError ? 'pin-error' : undefined}
                      className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
                      autoFocus
                    />
                  </label>
                </m.div>

                <AnimatePresence>
                  {pinError && (
                    <m.div key="err" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-6">
                      <LowerThird surface="night" tab="bg-error-300" className="w-full">
                        <span id="pin-error" role="alert" className="text-body">
                          {pinError}
                        </span>
                      </LowerThird>
                    </m.div>
                  )}
                </AnimatePresence>

                <Button
                  key={complete ? 'armed' : 'waiting'}
                  type="submit"
                  size="xl"
                  fullWidth
                  variant={complete ? 'volt' : 'night'}
                  armed={complete}
                  loading={checking}
                  disabled={!complete}
                  rightIcon={<ArrowRight className="size-5" />}
                  className="mt-8"
                >
                  {complete ? 'Enter' : `${6 - pin.length} more ${6 - pin.length === 1 ? 'digit' : 'digits'}`}
                </Button>
              </div>

              <div className="mt-auto pt-10">
                <Link to="/login" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-night-muted hover:text-night-text">
                  Teacher? Sign in
                </Link>
              </div>
            </form>
            <aside aria-hidden className="hidden items-center border-l border-night-rule px-12 lg:flex">
              <JoinDiagram />
            </aside>
          </m.div>
        ) : (
          <m.form
            key="profile"
            onSubmit={(e) => void submitProfile(e)}
            noValidate
            variants={stepSlide(1)}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mx-auto w-full max-w-6xl px-5 pt-4 pb-32 sm:px-10 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pb-12"
          >
            <div className="lg:sticky lg:top-6 lg:self-start">
              <ScoreBug className="w-full pr-1" tab="bg-signal-400">
                <span className="min-w-0 flex-1">
                  <span className="type-kicker block">Joining</span>
                  <span className="line-clamp-2 text-body font-semibold">{found!.quizTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFound(null)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm px-3 text-body-sm font-semibold text-night-muted hover:bg-night-800 hover:text-night-text"
                >
                  <ArrowLeft className="size-4" /> Different PIN
                </button>
              </ScoreBug>

              <h1 className="sr-only">Who’s playing?</h1>
              <AvatarHero
                value={profile.avatar}
                onChange={(avatar) => setProfile((p) => ({ ...p, avatar }))}
                nickname={profile.nickname}
                className="mt-8"
              />

              <TextField
                tone="night"
                label="Nickname"
                className="mt-8"
                value={profile.nickname}
                onChange={(e) => {
                  setProfile((p) => ({ ...p, nickname: e.target.value }));
                  setNicknameError(null);
                }}
                maxLength={NICKNAME_MAX + 8}
                autoComplete="nickname"
                enterKeyHint="done"
                placeholder="e.g. Sam R"
                labelAside={<span className="tabular">{nicknameLength}/{NICKNAME_MAX}</span>}
                hint="2–16 characters. Your teacher and class see this name."
                error={nicknameError ?? undefined}
              />

              <div className="mt-6 hidden lg:block">
                <Button type="submit" size="xl" variant="volt" fullWidth loading={joining}>
                  Join game
                </Button>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <h2 className="type-kicker mb-3">Build your look</h2>
              <AvatarBuilder value={profile.avatar} onChange={(avatar) => setProfile((p) => ({ ...p, avatar }))} />
            </div>

            <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-night-rule bg-night-950 px-5 pt-3 lg:hidden">
              <Button type="submit" size="xl" variant="volt" fullWidth loading={joining} className="mb-3">
                Join game
              </Button>
            </div>
          </m.form>
        )}
      </AnimatePresence>
    </NightCanvas>
  );
}

/** Flat illustration: the PIN is on the teacher's screen; type it on your phone. */
function JoinDiagram() {
  return (
    <figure className="w-full">
      <svg viewBox="0 0 520 300" className="w-full">
        {/* projector screen */}
        <rect x="140" y="20" width="360" height="200" rx="10" fill="#10283C" stroke="#5C7891" />
        <rect x="140" y="20" width="6" height="200" fill="#44C654" />
        <text x="170" y="62" fill="#A9B9C8" fontFamily="Inter Variable, Inter, sans-serif" fontSize="14" fontWeight="700" letterSpacing="2">JOIN AT …/JOIN</text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={170 + i * 46 + (i > 2 ? 14 : 0)} y="150" width="34" height="4" fill="#5C7891" />
        ))}
        <rect x="408" y="100" width="70" height="70" rx="4" fill="#F3F6F9" />
        {/* phone */}
        <rect x="20" y="110" width="120" height="180" rx="16" fill="#0B1D2C" stroke="#F3F6F9" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={36 + i * 15} y="200" width="11" height="3" fill="#44C654" />
        ))}
        <rect x="36" y="232" width="88" height="26" rx="5" fill="#44C654" />
        {/* arrow */}
        <path d="M150 190 C 175 190 185 175 200 168" fill="none" stroke="#44C654" strokeWidth="3" strokeLinecap="round" />
        <path d="M193 160 L203 167 L192 173" fill="none" stroke="#44C654" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="type-kicker mt-6">The PIN is on your teacher’s screen</figcaption>
    </figure>
  );
}
