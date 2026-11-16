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

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || `admin@${SITE_DOMAIN}`;
