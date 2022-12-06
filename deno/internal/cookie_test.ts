// deno-lint-ignore-file no-explicit-any
import { DateTime } from "../deps/luxon/luxon.js";
import { assertEquals } from "../deps/std/testing/asserts.ts";
import {
  addCookies,
  Cookie,
  cookieString,
  readCookies,
  readSetCookies,
  SameSite,
  sanitizeCookiePath,
  sanitizeCookieValue,
  setCookies,
} from "./cookie.ts";
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
    return DateTime.utc(year, month, day, hour, min, sec, nsec).toJSDate();
  }
  static UTC = true;
}
interface CookieInit {
  Name?: string;
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
class HeaderOnlyResponseWriter {
  constructor(public readonly h: Headers) {
  }
  append(name: string, value: string) {
    this.h.append(name, value);
  }
}
function headerOnlyResponseWriter(h: Headers): Headers {
  const r: any = new HeaderOnlyResponseWriter(h);
  return r;
}
function getHeaders(m: Headers, name: string): Array<string> {
  const r = new Array<string>();
  for (const [k, v] of m) {
    if (k == name) {
      r.push(v);
    }
  }
  return r;
}
Deno.test("SetCookie", () => {
  const m = new Headers();
  setCookies(
    headerOnlyResponseWriter(m),
    initCookie({ Name: "cookie-1", Value: "one", Path: "/restricted/" }),
    initCookie({ Name: "cookie-2", Value: "two", MaxAge: 3600 }),
  );
  const vals = getHeaders(m, "set-cookie");
  assertEquals(vals.length, 2);

  assertEquals(vals[0], "cookie-1=one; Path=/restricted/");
  assertEquals(vals[1], "cookie-2=two; Max-Age=3600");
});

Deno.test("AddCookie", () => {
  function make(arrs: Array<CookieInit>, raw: string) {
    return {
      Cookies: arrs.map((v) => initCookie(v)),
      Raw: raw,
    };
  }
  const tests = [
    make(
      [{}],
      "",
    ),
    make(
      [{ Name: "cookie-1", Value: "v$1" }],
      "cookie-1=v$1",
    ),
    make(
      [
        { Name: "cookie-1", Value: "v$1" },
        { Name: "cookie-2", Value: "v$2" },
        { Name: "cookie-3", Value: "v$3" },
      ],
      "cookie-1=v$1; cookie-2=v$2; cookie-3=v$3",
    ),
  ];
  for (const tt of tests) {
    const h = new Headers();
    addCookies(h, ...tt.Cookies);

    assertEquals(
      h.get("Cookie") ?? "",
      tt.Raw,
      `val=${h.get("Cookie")} raw=${tt.Raw}`,
    );
  }
});
function assertCookiesEqual(l: Array<Cookie>, r: Array<Cookie>) {
  assertEquals(l.length, r.length);
  for (let i = 0; i < l.length; i++) {
    assertEquals(l[i].name, r[i].name);
    assertEquals(l[i].value, r[i].value);

    assertEquals(l[i].path, r[i].path);
    assertEquals(l[i].domain, r[i].domain);
    assertEquals(l[i].expires, r[i].expires);
    assertEquals(l[i].rawExpires, r[i].rawExpires);

    assertEquals(l[i].maxAge, r[i].maxAge);
    assertEquals(l[i].secure, r[i].secure);
    assertEquals(l[i].httpOnly, r[i].httpOnly);
    assertEquals(l[i].sameSite, r[i].sameSite);
    assertEquals(l[i].raw, r[i].raw);
    const len = l[i].unparsed?.length ?? 0;
    assertEquals(len, r[i].unparsed?.length ?? 0);
    for (let j = 0; j < len; j++) {
      assertEquals(l[i].unparsed![j], r[i].unparsed![j]);
    }
  }
}
Deno.test("ReadSetCookies", () => {
  function make(header: Headers, cookies: Array<CookieInit>) {
    return {
      header: header,
      cookies: cookies.map(initCookie),
    };
  }
  const tests = [
    make(
      new Headers({ "Set-Cookie": "Cookie-1=v$1" }),
      [{ Name: "Cookie-1", Value: "v$1", Raw: "Cookie-1=v$1" }],
    ),
    make(
      new Headers({
        "Set-Cookie":
          "NID=99=YsDT5i3E-CXax-; expires=Wed, 23-Nov-2011 01:05:03 GMT; path=/; domain=.google.ch; HttpOnly",
      }),
      [{
        Name: "NID",
        Value: "99=YsDT5i3E-CXax-",
        Path: "/",
        Domain: ".google.ch",
        HttpOnly: true,
        Expires: time.Date(2011, 11, 23, 1, 5, 3, 0, time.UTC),
        RawExpires: "Wed, 23-Nov-2011 01:05:03 GMT",
        Raw:
          "NID=99=YsDT5i3E-CXax-; expires=Wed, 23-Nov-2011 01:05:03 GMT; path=/; domain=.google.ch; HttpOnly",
      }],
    ),
    make(
      new Headers({
        "Set-Cookie":
          ".ASPXAUTH=7E3AA; expires=Wed, 07-Mar-2012 14:25:06 GMT; path=/; HttpOnly",
      }),
      [{
        Name: ".ASPXAUTH",
        Value: "7E3AA",
        Path: "/",
        Expires: time.Date(2012, 3, 7, 14, 25, 6, 0, time.UTC),
        RawExpires: "Wed, 07-Mar-2012 14:25:06 GMT",
        HttpOnly: true,
        Raw:
          ".ASPXAUTH=7E3AA; expires=Wed, 07-Mar-2012 14:25:06 GMT; path=/; HttpOnly",
      }],
    ),
    make(
      new Headers({ "Set-Cookie": "ASP.NET_SessionId=foo; path=/; HttpOnly" }),
      [{
        Name: "ASP.NET_SessionId",
        Value: "foo",
        Path: "/",
        HttpOnly: true,
        Raw: "ASP.NET_SessionId=foo; path=/; HttpOnly",
      }],
    ),
    make(
      new Headers({ "Set-Cookie": "samesitedefault=foo; SameSite" }),
      [{
        Name: "samesitedefault",
        Value: "foo",
        SameSite: SameSiteDefaultMode,
        Raw: "samesitedefault=foo; SameSite",
      }],
    ),
    make(
      new Headers({
        "Set-Cookie": "samesiteinvalidisdefault=foo; SameSite=invalid",
      }),
      [{
        Name: "samesiteinvalidisdefault",
        Value: "foo",
        SameSite: SameSiteDefaultMode,
        Raw: "samesiteinvalidisdefault=foo; SameSite=invalid",
      }],
    ),
    make(
      new Headers({ "Set-Cookie": "samesitelax=foo; SameSite=Lax" }),
      [{
        Name: "samesitelax",
        Value: "foo",
        SameSite: SameSiteLaxMode,
        Raw: "samesitelax=foo; SameSite=Lax",
      }],
    ),
    make(
      new Headers({ "Set-Cookie": "samesitestrict=foo; SameSite=Strict" }),
      [{
        Name: "samesitestrict",
        Value: "foo",
        SameSite: SameSiteStrictMode,
        Raw: "samesitestrict=foo; SameSite=Strict",
      }],
    ),
    make(
      new Headers({ "Set-Cookie": "samesitenone=foo; SameSite=None" }),
      [{
        Name: "samesitenone",
        Value: "foo",
        SameSite: SameSiteNoneMode,
        Raw: "samesitenone=foo; SameSite=None",
      }],
    ),
    // Make sure we can properly read back the Set-Cookie headers we create
    // for values containing spaces or commas:
    make(
      new Headers({ "Set-Cookie": `special-1=a z` }),
      [{ Name: "special-1", Value: "a z", Raw: `special-1=a z` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-2=" z"` }),
      [{ Name: "special-2", Value: " z", Raw: `special-2=" z"` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-3="a "` }),
      [{ Name: "special-3", Value: "a ", Raw: `special-3="a "` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-4=" "` }),
      [{ Name: "special-4", Value: " ", Raw: `special-4=" "` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-5=a,z` }),
      [{ Name: "special-5", Value: "a,z", Raw: `special-5=a,z` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-6=",z"` }),
      [{ Name: "special-6", Value: ",z", Raw: `special-6=",z"` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-7=a,` }),
      [{ Name: "special-7", Value: "a,", Raw: `special-7=a,` }],
    ),
    make(
      new Headers({ "Set-Cookie": `special-8=","` }),
      [{ Name: "special-8", Value: ",", Raw: `special-8=","` }],
    ),
    // TODO(bradfitz): users have reported seeing this in the
    // wild, but do browsers handle it? RFC 6265 just says "don't
    // do that" (section 3) and then never mentions header folding
    // again.
    // Header{"Set-Cookie": {"ASP.NET_SessionId=foo; path=/; HttpOnly, .ASPXAUTH=7E3AA; expires=Wed, 07-Mar-2012 14:25:06 GMT; path=/; HttpOnly"}},
  ];
  for (const tt of tests) {
    for (let n = 0; n < 2; n++) { // to verify readSetCookies doesn't mutate its input
      const c = readSetCookies(tt.header)!;

      assertCookiesEqual(c, tt.cookies);
    }
  }
});
Deno.test("ReadCookies", () => {
  function make(header: Headers, filter: string, cookies: Array<CookieInit>) {
    return {
      header: header,
      filter: filter,
      cookies: cookies.map(initCookie),
    };
  }
  const tests = [
    make(
      new Headers({ "Cookie": "Cookie-1=v$1;c2=v2" }),
      "",
      [
        { Name: "Cookie-1", Value: "v$1" },
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": "Cookie-1=v$1;c2=v2" }),
      "c2",
      [
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": "Cookie-1=v$1; c2=v2" }),
      "",
      [
        { Name: "Cookie-1", Value: "v$1" },
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": "Cookie-1=v$1; c2=v2" }),
      "c2",
      [
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": `Cookie-1="v$1"; c2="v2"` }),
      "",
      [
        { Name: "Cookie-1", Value: "v$1" },
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": `Cookie-1="v$1"; c2=v2;` }),
      "",
      [
        { Name: "Cookie-1", Value: "v$1" },
        { Name: "c2", Value: "v2" },
      ],
    ),
    make(
      new Headers({ "Cookie": `` }),
      "",
      [],
    ),
  ];
  for (const tt of tests) {
    for (let n = 0; n < 2; n++) { // to verify readSetCookies doesn't mutate its input
      const c = readCookies(tt.header, tt.filter) ?? [];

      assertCookiesEqual(c, tt.cookies);
    }
  }
});
Deno.test("SetCookieDoubleQuotes", () => {
  const h = new Headers();
  h.append("Set-Cookie", `quoted0=none; max-age=30`);
  h.append("Set-Cookie", `quoted1="cookieValue"; max-age=31`);
  h.append("Set-Cookie", `quoted2=cookieAV; max-age="32"`);
  h.append("Set-Cookie", `quoted3="both"; max-age="33"`);
  const got = readSetCookies(h)!;
  const want = [
    initCookie({ Name: "quoted0", Value: "none", MaxAge: 30 }),
    initCookie({ Name: "quoted1", Value: "cookieValue", MaxAge: 31 }),
    initCookie({ Name: "quoted2", Value: "cookieAV" }),
    initCookie({ Name: "quoted3", Value: "both" }),
  ];
  assertEquals(got.length, want.length);
  for (let i = 0; i < got.length; i++) {
    const g = got[i];
    const w = want[i];
    assertEquals(g.name, w.name);
    assertEquals(g.value, w.value);
    assertEquals(g.maxAge, w.maxAge);
  }
});
Deno.test("CookieSanitizeValue", () => {
  function make(i: string, want: string) {
    return {
      in: i,
      want: want,
    };
  }
  const tests = [
    make("foo", "foo"),
    make("foo;bar", "foobar"),
    make("foo\\bar", "foobar"),
    make('foo"bar', "foobar"),
    make("\x00\x7e\x7f\x80", "\x7e"),
    make(`"withquotes"`, "withquotes"),
    make("a z", `"a z"`),
    make(" z", `" z"`),
    make("a ", `"a "`),
    make("a,z", `"a,z"`),
    make(",z", `",z"`),
    make("a,", `"a,"`),
  ];
  for (const tt of tests) {
    assertEquals(sanitizeCookieValue(tt.in), tt.want);
  }
});
Deno.test("CookieSanitizePath", () => {
  function make(i: string, want: string) {
    return {
      in: i,
      want: want,
    };
  }
  const tests = [
    make("/path", "/path"),
    make("/path with space/", "/path with space/"),
    make("/just;no;semicolon\x00orstuff/", "/justnosemicolonorstuff/"),
  ];
  for (const tt of tests) {
    assertEquals(sanitizeCookiePath(tt.in), tt.want);
  }
});
