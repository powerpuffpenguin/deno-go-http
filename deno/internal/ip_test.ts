// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "../../deps/std/testing/asserts.ts";
import { isIP } from "./ip.ts";
Deno.test("JarKey", () => {
  const tests: any = {
    // "127.0.0.1": true,
    // "1.2.3.4": true,
    "2001:4860:0:2001::68": true,
    // "example.com": false,
    // "1.1.1.300": false,
    // "www.foo.bar.net": false,
    // "123.foo.bar.net": false,
  };
  for (const host in tests) {
    if (Object.prototype.hasOwnProperty.call(tests, host)) {
      const want = tests[host];
      const got = isIP(host);
      assertEquals(got, want, host);
    }
  }
});
