import { DateTime } from "../deps/luxon/luxon.js";
export function toHTTP(d: Date): string {
  return DateTime.fromJSDate(d).toHTTP();
}

// Mon, 02-Jan-2006 15:04:05 MST
const match =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d\d)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4}) (\d\d):(\d\d):(\d\d) GMT$/;
export function fromHTTP(s: string): Date | undefined {
  if (match.test(s)) {
    s = s.replaceAll("-", " ");
  }
  const d = DateTime.fromHTTP(s);
  if (d.isValid) {
    return d.toJSDate();
  }
}
