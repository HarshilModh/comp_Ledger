/**
 * Sanitize extracted text content before storing/embedding.
 * Strips control characters, null bytes, and excessive whitespace.
 * Truncates to a safe max length for embedding models.
 */

const MAX_BODY_LENGTH = 100_000;

export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove null bytes and control characters (except newlines/tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove any remaining HTML tags that slipped through
    .replace(/<[^>]*>/g, ' ')
    // Remove HTML entities
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Enforce max length
    .slice(0, MAX_BODY_LENGTH);
}

export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Only allow http/https protocols
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  // Block javascript:, data:, and other dangerous protocols that might be encoded
  if (/javascript:|data:|vbscript:/i.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, 2048);
}

export function sanitizeTitle(title) {
  if (!title || typeof title !== 'string') return '';

  return title
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
