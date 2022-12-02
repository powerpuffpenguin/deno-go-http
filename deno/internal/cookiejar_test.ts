// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "../../deps/std/testing/asserts.ts";
import {
  canonicalHost,
  defaultPath,
  domainAndType,
  hasDotSuffix,
  jarKey,
} from "./cookiejar.ts";
Deno.test("DotSuffix", () => {
  const hasDotSuffixTests = [
    ["", ""],
    ["", "."],
    ["", "x"],
    [".", ""],
    [".", "."],
    [".", ".."],
    [".", "x"],
    [".", "x."],
    [".", ".x"],
    [".", ".x."],
    ["x", ""],
    ["x", "."],
    ["x", ".."],
    ["x", "x"],
    ["x", "x."],
    ["x", ".x"],
    ["x", ".x."],
    [".x", ""],
    [".x", "."],
    [".x", ".."],
    [".x", "x"],
    [".x", "x."],
    [".x", ".x"],
    [".x", ".x."],
    ["x.", ""],
    ["x.", "."],
    ["x.", ".."],
    ["x.", "x"],
    ["x.", "x."],
    ["x.", ".x"],
    ["x.", ".x."],
    ["com", ""],
    ["com", "m"],
    ["com", "om"],
    ["com", "com"],
    ["com", ".com"],
    ["com", "x.com"],
    ["com", "xcom"],
    ["com", "xorg"],
    ["com", "org"],
    ["com", "rg"],
    ["foo.com", ""],
    ["foo.com", "m"],
    ["foo.com", "om"],
    ["foo.com", "com"],
    ["foo.com", ".com"],
    ["foo.com", "o.com"],
    ["foo.com", "oo.com"],
    ["foo.com", "foo.com"],
    ["foo.com", ".foo.com"],
    ["foo.com", "x.foo.com"],
    ["foo.com", "xfoo.com"],
    ["foo.com", "xfoo.org"],
    ["foo.com", "foo.org"],
    ["foo.com", "oo.org"],
    ["foo.com", "o.org"],
    ["foo.com", ".org"],
    ["foo.com", "org"],
    ["foo.com", "rg"],
  ];
  for (const v of hasDotSuffixTests) {
    const got = hasDotSuffix(v[0], v[1]);
    const want = v[0].endsWith("." + v[1]);
    assertEquals(got, want);
  }
});
Deno.test("CanonicalHost", () => {
  const canonicalHostTests: any = {
    "www.example.com": "www.example.com",
    "WWW.EXAMPLE.COM": "www.example.com",
    "wWw.eXAmple.CoM": "www.example.com",
    "www.example.com:80": "www.example.com",
    "192.168.0.10": "192.168.0.10",
    "192.168.0.5:8080": "192.168.0.5",
    "2001:4860:0:2001::68": "2001:4860:0:2001::68",
    "[2001:4860:0:::68]:8080": "2001:4860:0:::68",
    "http://www.bücher.de": "www.xn--bcher-kva.de",
    "www.example.com.": "www.example.com",
    // TODO: Fix canonicalHost so that all of the following malformed
    // domain names trigger an error. (This list is not exhaustive, e.g.
    // malformed internationalized domain names are missing.)
    ".": "",
    "..": ".",
    "...": "..",
    ".net": ".net",
    ".net.": ".net",
    "a..": "a.",
    "b.a..": "b.a.",
    "weird.stuff...": "weird.stuff..",
    "[bad.unmatched.bracket:": "error",
  };
  for (const h in canonicalHostTests) {
    if (Object.prototype.hasOwnProperty.call(canonicalHostTests, h)) {
      const want = canonicalHostTests[h];
      let got: string;
      if (want == "error") {
        try {
          got = canonicalHost(new URL(`http://${h}`).host);
        } catch (_) {
          got = "error";
        }
      } else {
        if (h.startsWith("http://")) {
          got = canonicalHost(new URL(h).host);
        } else {
          got = canonicalHost(h);
        }
      }
      assertEquals(got, want);
    }
  }
});
function testPublicSuffix(d: string): string {
  if (d == "co.uk" || d.endsWith(".co.uk")) {
    return "co.uk";
  }
  if (d == "www.buggy.psl") {
    return "xy";
  }
  if (d == "www2.buggy.psl") {
    return "com";
  }
  return d.substring(d.lastIndexOf(".") + 1);
}
Deno.test("JarKey", () => {
  const jarKeyTests: any = {
    "foo.www.example.com": "example.com",
    "www.example.com": "example.com",
    "example.com": "example.com",
    "com": "com",
    "foo.www.bbc.co.uk": "bbc.co.uk",
    "www.bbc.co.uk": "bbc.co.uk",
    "bbc.co.uk": "bbc.co.uk",
    "co.uk": "co.uk",
    "uk": "uk",
    "192.168.0.5": "192.168.0.5",
    "www.buggy.psl": "www.buggy.psl",
    "www2.buggy.psl": "buggy.psl",
    // The following are actual outputs of canonicalHost for
    // malformed inputs to canonicalHost (see above).
    "": "",
    ".": ".",
    "..": ".",
    ".net": ".net",
    "a.": "a.",
    "b.a.": "a.",
    "weird.stuff..": ".",
  };
  for (const host in jarKeyTests) {
    if (Object.prototype.hasOwnProperty.call(jarKeyTests, host)) {
      const want = jarKeyTests[host];
      const got = jarKey(host, testPublicSuffix);
      assertEquals(got, want);
    }
  }
});
Deno.test("JarKeyNilPSL", () => {
  const jarKeyTests: any = {
    "foo.www.example.com": "example.com",
    "www.example.com": "example.com",
    "example.com": "example.com",
    "com": "com",
    "foo.www.bbc.co.uk": "co.uk",
    "www.bbc.co.uk": "co.uk",
    "bbc.co.uk": "co.uk",
    "co.uk": "co.uk",
    "uk": "uk",
    "192.168.0.5": "192.168.0.5",
    // The following are actual outputs of canonicalHost for
    // malformed inputs to canonicalHost.
    "": "",
    ".": ".",
    "..": "..",
    ".net": ".net",
    "a.": "a.",
    "b.a.": "a.",
    "weird.stuff..": "stuff..",
  };
  for (const host in jarKeyTests) {
    if (Object.prototype.hasOwnProperty.call(jarKeyTests, host)) {
      const want = jarKeyTests[host];
      const got = jarKey(host);
      assertEquals(got, want);
    }
  }
});
Deno.test("DefaultPath", () => {
  const tests: any = {
    "/": "/",
    "/abc": "/",
    "/abc/": "/abc",
    "/abc/xyz": "/abc",
    "/abc/xyz/": "/abc/xyz",
    "/a/b/c.html": "/a/b",
    "": "/",
    "strange": "/",
    "//": "/",
    "/a//b": "/a/",
    "/a/./b": "/a/.",
    "/a/../b": "/a/..",
  };
  for (const host in tests) {
    if (Object.prototype.hasOwnProperty.call(tests, host)) {
      const want = tests[host];
      const got = defaultPath(host);
      assertEquals(got, want);
    }
  }
});
Deno.test("DomainAndType", () => {
  const tests: Array<[string, string, string, boolean, boolean]> = [
    ["www.example.com", "", "www.example.com", true, false],
    ["127.0.0.1", "", "127.0.0.1", true, false],
    ["2001:4860:0:2001::68", "", "2001:4860:0:2001::68", true, false],
    ["www.example.com", "example.com", "example.com", false, false],
    ["www.example.com", ".example.com", "example.com", false, false],
    ["www.example.com", "www.example.com", "www.example.com", false, false],
    ["www.example.com", ".www.example.com", "www.example.com", false, false],
    ["foo.sso.example.com", "sso.example.com", "sso.example.com", false, false],
    ["bar.co.uk", "bar.co.uk", "bar.co.uk", false, false],
    ["foo.bar.co.uk", ".bar.co.uk", "bar.co.uk", false, false],
    ["127.0.0.1", "127.0.0.1", "", false, true],
    [
      "2001:4860:0:2001::68",
      "2001:4860:0:2001::68",
      "2001:4860:0:2001::68",
      false,
      true,
    ],
    ["www.example.com", ".", "", false, true],
    ["www.example.com", "..", "", false, true],
    ["www.example.com", "other.com", "", false, true],
    ["www.example.com", "com", "", false, true],
    ["www.example.com", ".com", "", false, true],
    ["foo.bar.co.uk", ".co.uk", "", false, true],
    ["127.www.0.0.1", "127.0.0.1", "", false, true],
    ["com", "", "com", true, false],
    ["com", "com", "com", true, false],
    ["com", ".com", "com", true, false],
    ["co.uk", "", "co.uk", true, false],
    ["co.uk", "co.uk", "co.uk", true, false],
    ["co.uk", ".co.uk", "co.uk", true, false],
  ];
  for (const [host, domain, wantDomain, wantHostOnly, err] of tests) {
    const [d, hostOnly, ok] = domainAndType(host, domain, testPublicSuffix);
    assertEquals(ok, err, ` ${host} ${domain}`);

    if (err) {
      continue;
    }

    assertEquals(d, wantDomain);
    assertEquals(hostOnly, wantHostOnly);
  }
});
