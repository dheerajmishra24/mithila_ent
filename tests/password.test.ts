import { describe, it, expect } from 'vitest';
import { isStrongPassword, passwordError, PASSWORD_MIN_LENGTH } from '@/lib/password';

describe('password policy', () => {
  it('minimum length is 12', () => expect(PASSWORD_MIN_LENGTH).toBe(12));
  it('rejects 8 chars', () => expect(isStrongPassword('Ab1!aaaa')).toBe(false));
  it('rejects 11 chars', () => expect(isStrongPassword('Abcdef1!ghi')).toBe(false));
  it('rejects missing special char', () => expect(isStrongPassword('Abcdefgh1234')).toBe(false));
  it('rejects missing uppercase', () => expect(isStrongPassword('abcdef1!ghij')).toBe(false));
  it('rejects missing digit', () => expect(isStrongPassword('Abcdefgh!ijkl')).toBe(false));
  it('accepts a strong 12-char password', () => expect(isStrongPassword('Abcdef1!ghij')).toBe(true));
  it('passwordError is null when strong', () => expect(passwordError('Abcdef1!ghij')).toBeNull());
  it('passwordError mentions 12 when weak', () => expect(passwordError('weak')).toMatch(/12 characters/));
});
