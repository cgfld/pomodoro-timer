export function authErrorMessage(error) {
  const code = error?.code || error?.details?.code;
  if (code === 'otp_expired') return 'This email link has expired or has already been used. Request a new link and use the newest email.';
  if (code === 'invalid_credentials') return 'The email or password was not accepted. Try again, reset your password, or use an email sign-in link.';
  return error?.message || 'Unable to complete sign-in. Please try again.';
}
