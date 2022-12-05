// ToLower returns the lowercase version of s if s is ASCII and printable.
export function toLower(s: string): string | undefined {
  if (!isPrint(s)) {
    return;
  }
  return s.toLowerCase();
}
// IsPrint returns whether s is ASCII and printable according to
// https://tools.ietf.org/html/rfc20#section-4.2.
export function isPrint(s: string): boolean {
  for (const c of s) {
    if (c < " " || c > "~") {
      return false;
    }
  }
  return true;
}
// Is returns whether s is ASCII.
export function is(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}
