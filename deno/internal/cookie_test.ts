import { DateTime } from "../../deps/luxon/luxon.js";
import { assertEquals } from "../../deps/std/testing/asserts.ts";
import { Cookie, cookieString, SameSite } from "./cookie.ts";
const SameSiteDefaultMode = SameSite.DefaultMode;
const SameSiteLaxMode = SameSite.LaxMode;
const SameSiteNoneMode = SameSite.NoneMode;
const SameSiteStrictMode = SameSite.StrictMode;
const nil = undefined;
class time {
  private constructor() {}
  static Unix(v: number, _: number): Date {
    return new Date(v * 1000);
  }
  static Date(
    year: number,
    month: number,
    day: number,
    hour: number,
    min: number,
    sec: number,
    nsec: number,
    _: boolean,
  ) {
    return new Date(year, month, day, hour, min, sec, nsec);
  }
  static UTC = true;
}
interface CookieInit {
  Name: string;
  Value?: string;

  Path?: string; // optional
  Domain?: string; // optional
  Expires?: Date; // optional
  RawExpires?: string; // for reading cookies only

  // MaxAge=undefined means no 'Max-Age' attribute specified.
  // MaxAge<=0 means delete cookie now, equivalently 'Max-Age: 0'
  // MaxAge>0 means Max-Age attribute present and given in seconds
  MaxAge?: number;
  Secure?: boolean;
  HttpOnly?: boolean;
  SameSite?: SameSite;
  Raw?: string;
  Unparsed?: Array<string>; // Raw text of unparsed attribute-value pairs
}
function initCookie(o?: CookieInit): Cookie {
  return {
    name: o?.Name ?? "",
    value: o?.Value ?? "",

    path: o?.Path,
    domain: o?.Domain,
    expires: o?.Expires,
    rawExpires: o?.RawExpires,

    maxAge: o?.MaxAge,
    secure: o?.Secure,
    httpOnly: o?.HttpOnly,
    sameSite: o?.SameSite,
    raw: o?.Raw,
    unparsed: o?.Unparsed,
  };
}
Deno.test("WriteSetCookies", () => {
  function make(cookie: CookieInit | undefined, raw: string) {
    return {
      Cookie: initCookie(cookie),
      Raw: raw,
    };
  }
  const tests = [
    make({ Name: "cookie-1", Value: "v$1" }, "cookie-1=v$1"),
    make(
      { Name: "cookie-2", Value: "two", MaxAge: 3600 },
      "cookie-2=two; Max-Age=3600",
    ),
    make(
      { Name: "cookie-3", Value: "three", Domain: ".example.com" },
      "cookie-3=three; Domain=example.com",
    ),
    make(
      { Name: "cookie-4", Value: "four", Path: "/restricted/" },
      "cookie-4=four; Path=/restricted/",
    ),
    make(
      { Name: "cookie-5", Value: "five", Domain: "wrong;bad.abc" },
      "cookie-5=five",
    ),
    make(
      { Name: "cookie-6", Value: "six", Domain: "bad-.abc" },
      "cookie-6=six",
    ),
    make(
      { Name: "cookie-7", Value: "seven", Domain: "127.0.0.1" },
      "cookie-7=seven; Domain=127.0.0.1",
    ),
    make({ Name: "cookie-8", Value: "eight", Domain: "::1" }, "cookie-8=eight"),
    make({
      Name: "cookie-9",
      Value: "expiring",
      Expires: time.Unix(1257894000, 0),
    }, "cookie-9=expiring; Expires=Tue, 10 Nov 2009 23:00:00 GMT"),
    // According to IETF 6265 Section 5.1.1.5, the year cannot be less than 1601
    make({
      Name: "cookie-10",
      Value: "expiring-1601",
      Expires: time.Date(1601, 1, 1, 1, 1, 1, 1, time.UTC),
    }, "cookie-10=expiring-1601; Expires=Mon, 01 Jan 1601 01:01:01 GMT"),
    make({
      Name: "cookie-11",
      Value: "invalid-expiry",
      Expires: time.Date(1600, 1, 1, 1, 1, 1, 1, time.UTC),
    }, "cookie-11=invalid-expiry"),
    make({
      Name: "cookie-12",
      Value: "samesite-default",
      SameSite: SameSiteDefaultMode,
    }, "cookie-12=samesite-default"),
    make({
      Name: "cookie-13",
      Value: "samesite-lax",
      SameSite: SameSiteLaxMode,
    }, "cookie-13=samesite-lax; SameSite=Lax"),
    make({
      Name: "cookie-14",
      Value: "samesite-strict",
      SameSite: SameSiteStrictMode,
    }, "cookie-14=samesite-strict; SameSite=Strict"),
    make({
      Name: "cookie-15",
      Value: "samesite-none",
      SameSite: SameSiteNoneMode,
    }, "cookie-15=samesite-none; SameSite=None"),
    // The "special" cookies have values containing commas or spaces which
    // are disallowed by RFC 6265 but are common in the wild.
    make({ Name: "special-1", Value: "a z" }, `special-1="a z"`),
    make({ Name: "special-2", Value: " z" }, `special-2=" z"`),
    make({ Name: "special-3", Value: "a " }, `special-3="a "`),
    make({ Name: "special-4", Value: " " }, `special-4=" "`),
    make({ Name: "special-5", Value: "a,z" }, `special-5="a,z"`),
    make({ Name: "special-6", Value: ",z" }, `special-6=",z"`),
    make({ Name: "special-7", Value: "a," }, `special-7="a,"`),
    make({ Name: "special-8", Value: "," }, `special-8=","`),
    make({ Name: "empty-value", Value: "" }, `empty-value=`),
    make(
      nil,
      ``,
    ),
    make({ Name: "" }, ``),
    make({ Name: "\t" }, ``),
    make({ Name: "\r" }, ``),
    make({ Name: "a\nb", Value: "v" }, ``),
    make({ Name: "a\nb", Value: "v" }, ``),
    make({ Name: "a\rb", Value: "v" }, ``),
  ];
  for (const tt of tests) {
    assertEquals(cookieString(tt.Cookie), tt.Raw);
  }
});
