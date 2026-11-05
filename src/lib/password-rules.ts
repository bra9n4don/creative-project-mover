export const MIN_PASSWORD = 12;

/** Returns a plain error message, or null when the new password is acceptable. */
export function checkNewPassword(pw: string, confirm?: string, current?: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (confirm !== undefined && pw !== confirm) return "The two passwords don't match.";
  if (current && pw === current) return "Pick a password different from your current one.";
  return null;
}
