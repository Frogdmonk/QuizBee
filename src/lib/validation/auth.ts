import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .pipe(z.email('Enter a valid email address.'));

/** bcrypt (used by Supabase Auth) ignores bytes beyond 72, so cap there. */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(60, 'Keep your name under 60 characters.');

export const schoolNameSchema = z.string().trim().max(120, 'Keep the school name under 120 characters.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const profileSchema = z.object({
  displayName: displayNameSchema,
  schoolName: schoolNameSchema,
});
export type ProfileValues = z.infer<typeof profileSchema>;
