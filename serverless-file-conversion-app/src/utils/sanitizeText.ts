/**
 * Sanitize text for pdf-lib StandardFonts (WinAnsi encoding).
 * 
 * pdf-lib's built-in StandardFonts (Helvetica, Courier, Times, etc.)
 * only support the WinAnsi character set (code page 1252).
 * Characters outside this range — such as emojis, CJK characters,
 * or extended Unicode symbols — will throw:
 *   "WinAnsi cannot encode "X" (0xNNNN)"
 * 
 * This utility strips or replaces unsupported characters so that
 * text can be safely drawn with StandardFonts.
 */

// WinAnsi (CP1252) supports code points up to 0xFF with a few
// specific mappings in the 0x80-0x9F range. For simplicity we
// accept all printable ASCII (0x20-0x7E), tab (0x09), newline
// (0x0A, 0x0D), and the Latin-1 Supplement block (0xA0-0xFF).
// Characters in 0x80-0x9F that are valid in CP1252 are also allowed.
const WINANSI_EXTRAS = new Set([
  0x20AC, // €
  0x201A, // ‚
  0x0192, // ƒ
  0x201E, // „
  0x2026, // …
  0x2020, // †
  0x2021, // ‡
  0x02C6, // ˆ
  0x2030, // ‰
  0x0160, // Š
  0x2039, // ‹
  0x0152, // Œ
  0x017D, // Ž
  0x2018, // '
  0x2019, // '
  0x201C, // "
  0x201D, // "
  0x2022, // •
  0x2013, // –
  0x2014, // —
  0x02DC, // ˜
  0x2122, // ™
  0x0161, // š
  0x203A, // ›
  0x0153, // œ
  0x017E, // ž
  0x0178, // Ÿ
]);

/**
 * Common Unicode → ASCII replacement map for readability.
 * Smart quotes, dashes, arrows, bullets, and other common
 * characters are replaced with their closest ASCII equivalent.
 */
const REPLACEMENT_MAP: Record<number, string> = {
  // Smart quotes → straight quotes
  0x2018: "'",  // '
  0x2019: "'",  // '
  0x201C: '"',  // "
  0x201D: '"',  // "
  0x201A: ',',  // ‚
  0x201E: '"',  // „

  // Dashes
  0x2013: '-',  // –
  0x2014: '--', // —
  0x2015: '--', // ―

  // Bullets / dots
  0x2022: '*',  // •
  0x2023: '>',  // ‣
  0x25CF: '*',  // ●
  0x25CB: 'o',  // ○
  0x25A0: '#',  // ■
  0x25AA: '*',  // ▪
  0x2026: '...', // …

  // Arrows
  0x2192: '->',  // →
  0x2190: '<-',  // ←
  0x2191: '^',   // ↑
  0x2193: 'v',   // ↓
  0x21D2: '=>',  // ⇒
  0x21D0: '<=',  // ⇐
  0x27A4: '->',  // ➤

  // Math / symbols
  0x2212: '-',   // −
  0x00D7: 'x',   // ×
  0x00F7: '/',   // ÷
  0x2264: '<=',  // ≤
  0x2265: '>=',  // ≥
  0x2260: '!=',  // ≠
  0x221E: 'inf', // ∞
  0x00B1: '+/-', // ±
  0x2248: '~=',  // ≈
  0x221A: 'sqrt', // √
  0x2211: 'sum', // ∑
  0x220F: 'prod', // ∏
  0x222B: 'int', // ∫

  // Misc
  0x2122: '(TM)', // ™
  0x00A9: '(c)',   // ©
  0x00AE: '(R)',   // ®
  0x2020: '+',     // †
  0x2021: '++',    // ‡
  0x00B0: 'deg',   // °
  0x2030: 'permil', // ‰

  // Check / cross marks
  0x2713: '[v]',   // ✓
  0x2714: '[v]',   // ✔
  0x2715: '[x]',   // ✕
  0x2716: '[x]',   // ✖
  0x2717: '[x]',   // ✗
  0x2718: '[x]',   // ✘

  // Box drawing (simplify)
  0x250C: '+', 0x2510: '+', 0x2514: '+', 0x2518: '+',
  0x2500: '-', 0x2502: '|', 0x253C: '+',
};

function isWinAnsiSafe(code: number): boolean {
  // Standard printable ASCII
  if (code >= 0x20 && code <= 0x7E) return true;
  // Tab, newline, carriage return
  if (code === 0x09 || code === 0x0A || code === 0x0D) return true;
  // Latin-1 Supplement (0xA0-0xFF)
  if (code >= 0xA0 && code <= 0xFF) return true;
  // Specific WinAnsi extras in 0x80-0x9F range (mapped from Unicode)
  if (WINANSI_EXTRAS.has(code)) return true;
  return false;
}

/**
 * Sanitize a string for safe use with pdf-lib StandardFonts.
 * 
 * - Replaces known Unicode characters with ASCII equivalents
 * - Strips emojis and other unsupported characters
 * - Preserves all WinAnsi-safe characters
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return text;

  let result = '';

  // Use Array.from to correctly handle surrogate pairs (emojis, etc.)
  const chars = Array.from(text);

  for (const char of chars) {
    const code = char.codePointAt(0)!;

    // Fast path: WinAnsi safe
    if (isWinAnsiSafe(code)) {
      result += char;
      continue;
    }

    // Try replacement map
    if (REPLACEMENT_MAP[code] !== undefined) {
      result += REPLACEMENT_MAP[code];
      continue;
    }

    // Emoji detection: surrogate pairs (code > 0xFFFF) or known emoji ranges
    // Simply skip emojis and other high-range Unicode
    if (code > 0xFF) {
      // Skip - character not representable in WinAnsi
      continue;
    }

    // Fallback: include as-is if in basic Latin range
    result += char;
  }

  return result;
}

/**
 * Sanitize text and also clean up any resulting double-spaces
 * or leading/trailing whitespace artifacts.
 */
export function sanitizeAndClean(text: string): string {
  return sanitizeForPdf(text)
    .replace(/  +/g, ' ')
    .trim();
}
