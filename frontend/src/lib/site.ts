export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://tulusy.cc'
).replace(/\/+$/, '');

export const SITE_DOMAIN = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return 'tulusy.cc';
  }
})();
