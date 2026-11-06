import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { m, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { Spinner } from './Spinner';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

const tap = { y: 2 };

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
};

export type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> &
  CommonProps & {
    loading?: boolean;
    /**
     * Plays the one-shot "armed" wipe: the fill sweeps in from the left. Use when a CTA becomes
     * available (e.g. all six PIN digits entered). Re-trigger by changing the button's key.
     */
    armed?: boolean;
  };

/** Button with a 2px press (spring), a level-meter loading state and no opacity-based disabled look. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  armed = false,
  leftIcon,
  rightIcon,
  fullWidth,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <m.button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileTap={isDisabled ? undefined : tap}
      transition={spring.press}
      className={cn(buttonClasses(variant, size, fullWidth, { jsPress: true }), armed && !isDisabled && 'wipe-fill', className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </m.button>
  );
}

export type ButtonLinkProps = Omit<LinkProps, 'children'> & CommonProps;

/**
 * A router link styled as a button (navigation should be a link, not a button).
 * Uses the CSS press (translate 2px): same feel as Button, zero JS animation cost.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses(variant, size, fullWidth), className)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
