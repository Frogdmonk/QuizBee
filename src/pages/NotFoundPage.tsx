import { ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-12" />
        <p className="mt-6 font-display text-6xl font-extrabold text-ink-200">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">This page does not exist</h1>
        <p className="mt-2 text-ink-600">Check the address, or head back to the start.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/">Go home</ButtonLink>
          <ButtonLink to="/join" variant="secondary">
            Join a game
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
