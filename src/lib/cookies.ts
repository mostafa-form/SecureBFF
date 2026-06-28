export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path:     '/',
};

export const ACCESS_TOKEN_MAX_AGE  = 60 * 15;            // 15 minutes in seconds
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;  // 30 days in seconds
