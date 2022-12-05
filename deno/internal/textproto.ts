// TrimString returns s without leading and trailing ASCII space.
export function trim(s: string): string {
  while (s.length > 0 && isASCIISpace(s[0])) {
    s = s.substring(1);
  }
  while (s.length > 0 && isASCIISpace(s[s.length - 1])) {
    s = s.substring(0, s.length - 1);
  }
  return s;
}
function isASCIISpace(b: string): boolean {
  return b == " " || b == "\t" || b == "\n" || b == "\r";
}
