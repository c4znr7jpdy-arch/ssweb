const LOCAL_ORIGIN = 'http://local.invalid';

function normalizeMediaUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/[\u0000-\u001f\u007f"'\\<>]/.test(raw)) return undefined;

  try {
    if (raw.startsWith('/')) {
      if (raw.startsWith('//')) return undefined;
      const url = new URL(raw, LOCAL_ORIGIN);
      if (url.origin !== LOCAL_ORIGIN) return undefined;
      return `${url.pathname}${url.search}${url.hash}`;
    }

    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

module.exports = { normalizeMediaUrl };
