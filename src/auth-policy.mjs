export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error(`Use no more than ${MAX_PASSWORD_LENGTH} characters for your password.`);
}
export function authErrorMessage(error) {
  const code = error?.code || error?.details?.code;
  if (code === 'otp_expired') return 'This email link has expired or has already been used. Request a new link and use the newest email.';
  if (code === 'invalid_credentials') return 'The email or password was not accepted. Try again, reset your password, or use an email sign-in link.';
  return error?.message || 'Unable to complete sign-in. Please try again.';
}
