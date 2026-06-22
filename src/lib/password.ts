// Centralized password policy — single source of truth for signup AND reset.
// Minimum 8 chars with lowercase, uppercase, a digit, and a special character.
export const PASSWORD_MIN_LENGTH = 12;

export const passwordRules: { label: string; test: (pw: string) => boolean }[] = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function isStrongPassword(pw: string): boolean {
  return passwordRules.every((r) => r.test(pw));
}

export function passwordError(pw: string): string | null {
  return isStrongPassword(pw)
    ? null
    : `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, a number, and a special character.`;
}
