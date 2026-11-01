/** The flag emoji for an ISO 3166-1 alpha-2 code, or a globe when there is no country. */
export const countryFlag = (code: string | null): string =>
  code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...Array.from(code, (letter) => 0x1f1a5 + letter.charCodeAt(0)))
    : '\u{1F310}';
