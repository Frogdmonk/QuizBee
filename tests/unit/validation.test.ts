import { describe, expect, it } from 'vitest';
import { loginSchema, passwordSchema, registerSchema } from '@/lib/validation/auth';
import { safeNextPath } from '@/lib/redirect';
import { friendlyError } from '@/utils/errors';
import { cn } from '@/lib/cn';

describe('safeNextPath (open-redirect protection)', () => {
  it.each([
    ['/teacher/profile', '/teacher/profile'],
    ['/teacher/quizzes?tab=1', '/teacher/quizzes?tab=1'],
    [null, '/teacher/dashboard'],
    ['https://evil.example', '/teacher/dashboard'],
    ['//evil.example', '/teacher/dashboard'],
    ['/\\evil.example', '/teacher/dashboard'],
    ['javascript:alert(1)', '/teacher/dashboard'],
  ])('%s -> %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe('auth schemas', () => {
  it('requires letters and numbers in passwords', () => {
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('abcd1234').success).toBe(true);
    expect(passwordSchema.safeParse('a1'.repeat(40)).success).toBe(false);
  });

  it('trims and validates emails', () => {
    const r = loginSchema.safeParse({ email: '  teacher@school.test ', password: 'x' });
    expect(r.success && r.data.email).toBe('teacher@school.test');
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('requires matching password confirmation', () => {
    const r = registerSchema.safeParse({
      displayName: 'Ms Rivera',
      email: 'r@school.test',
      password: 'abcd1234',
      confirmPassword: 'abcd12345',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['confirmPassword']);
  });

  it('rejects blank display names', () => {
    const r = registerSchema.safeParse({ displayName: '   ', email: 'r@school.test', password: 'abcd1234', confirmPassword: 'abcd1234' });
    expect(r.success).toBe(false);
  });
});

describe('friendlyError', () => {
  it('maps Supabase auth codes', () => {
    expect(friendlyError({ code: 'invalid_credentials', message: 'x' })).toMatch(/not correct/);
  });
  it('maps network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/internet connection/);
  });
  it('never leaks raw unknown messages', () => {
    expect(friendlyError(new Error('relation "secret_table" does not exist'), 'Fallback')).toBe('Fallback');
  });
});

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', false, null, ['b', undefined, ['c']], 0, 'd')).toBe('a b c d');
  });
});
