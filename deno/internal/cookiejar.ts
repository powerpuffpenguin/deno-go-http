import { IP } from "../../deps/easyts/net/ip.ts";
function isIP(s: string): boolean {
  return IP.parse(s) ? true : false;
}
// hasDotSuffix reports whether s ends in "."+suffix.
export function hasDotSuffix(s: string, suffix: string): boolean {
  return s.length > suffix.length &&
    s[s.length - suffix.length - 1] == "." &&
    s.substring(s.length - suffix.length) == suffix;
}
export function canonicalHost(s: string): string {
  if (s[0] == "[") {
    s = s.substring(1, s.indexOf("]"));
  } else {
    const i = s.lastIndexOf(":");
    if (i >= 0 && s.indexOf(":") == i) {
      s = s.substring(0, i);
    }
  }
  if (s.endsWith(".")) {
    s = s.substring(0, s.length - 1);
  }
  return s.toLowerCase();
}

// jarKey returns the key to use for a jar.
export function jarKey(
  host: string,
  publicSuffix?: (domain: string) => string,
): string {
  if (isIP(host)) {
    return host;
  }

  let i: number;
  if (publicSuffix === undefined) {
    i = host.lastIndexOf(".");
    if (i <= 0) {
      return host;
    }
  } else {
    const suffix = publicSuffix(host);
    if (suffix == host) {
      return host;
    }
    i = host.length - suffix.length;
    if (i <= 0 || host[i - 1] != ".") {
      // The provided public suffix list psl is broken.
      // Storing cookies under host is a safe stopgap.
      return host;
    }
    // Only len(suffix) is used to determine the jar key from
    // here on, so it is okay if psl.PublicSuffix("www.buggy.psl")
    // returns "com" as the jar key is generated from host.
  }

  const prevDot = host.substring(0, i - 1).lastIndexOf(".");
  return prevDot == -1 ? host : host.substring(prevDot + 1);
}
// defaultPath returns the directory part of an URL's path according to
// RFC 6265 section 5.1.4.
export function defaultPath(path: string): string {
  if (path.length == 0 || path[0] != "/") {
    return "/"; // Path is empty or malformed.
  }

  const i = path.lastIndexOf("/"); // Path starts with "/", so i != -1.
  if (i == 0) {
    return "/"; // Path has the form "/abc".
  }
  return path.substring(0, i); // Path is either of form "/abc/xyz" or "/abc/xyz/".
}

export function domainAndType(
  host: string,
  domain: string,
  publicSuffix?: (domain: string) => string,
): [string, boolean, boolean] {
  if (domain == "") {
    // No domain attribute in the SetCookie header indicates a
    // host cookie.
    return [host, true, false];
  }

  if (isIP(host)) {
    // According to RFC 6265 domain-matching includes not being
    // an IP address.
    // TODO: This might be relaxed as in common browsers.
    return ["", false, true];
  }

  // From here on: If the cookie is valid, it is a domain cookie (with
  // the one exception of a public suffix below).
  // See RFC 6265 section 5.2.3.
  if (domain[0] == ".") {
    domain = domain.substring(1);
  }

  if (domain.length == 0 || domain[0] == ".") {
    // Received either "Domain=." or "Domain=..some.thing",
    // both are illegal.
    return ["", false, true];
  }

  domain = domain.toLowerCase();

  if (domain[domain.length - 1] == ".") {
    // We received stuff like "Domain=www.example.com.".
    // Browsers do handle such stuff (actually differently) but
    // RFC 6265 seems to be clear here (e.g. section 4.1.2.3) in
    // requiring a reject.  4.1.2.3 is not normative, but
    // "Domain Matching" (5.1.3) and "Canonicalized Host Names"
    // (5.1.2) are.
    return ["", false, true];
  }

  // See RFC 6265 section 5.3 #5.
  if (publicSuffix) {
    const ps = publicSuffix(domain);
    if (ps != "" && !hasDotSuffix(domain, ps)) {
      if (host == domain) {
        // This is the one exception in which a cookie
        // with a domain attribute is a host cookie.
        return [host, true, false];
      }
      return ["", false, true];
    }
  }

  // The domain must domain-match host: www.mycompany.com cannot
  // set cookies for .ourcompetitors.com.
  if (host != domain && !hasDotSuffix(host, domain)) {
    return ["", false, true];
  }

  return [domain, false, false];
}
