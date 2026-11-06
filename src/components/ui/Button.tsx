import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { m, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

const tap = { scale: 0.97 };
const tapTransition = { type: 'spring', stiffness: 600, damping: 30 } as const;

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
  };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
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
      transition={tapTransition}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
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
 * Uses a CSS press effect: same feel as Button, zero JS animation cost.
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
    <Link
      className={cn(
        buttonClasses(variant, size, fullWidth),
        'transition-[color,background-color,border-color,transform] active:scale-[0.97]',
        className,
      )}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
