import { isTokenRune } from "./httpguts.ts";
import { DateTime } from "../../deps/luxon/luxon.js";
import { IP } from "../../deps/easyts/net/ip.ts";
import * as textproto from "./textproto.ts";
import * as ascii from "./ascii.ts";
export enum SameSite {
  DefaultMode = 1,
  LaxMode,
  StrictMode,
  NoneMode,
}
/**
 * A Cookie represents an HTTP cookie as sent in the Set-Cookie header of an
 */
export interface Cookie {
  name: string;
  value: string;

  path?: string; // optional
  domain?: string; // optional
  expires?: Date; // optional
  rawExpires?: string; // for reading cookies only

  // MaxAge=undefined means no 'Max-Age' attribute specified.
  // MaxAge<=0 means delete cookie now, equivalently 'Max-Age: 0'
  // MaxAge>0 means Max-Age attribute present and given in seconds
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSite;
  raw?: string;
  unparsed?: Array<string>; // Raw text of unparsed attribute-value pairs
}
/**
 * serialization cookie
 *
 * @remarks
 * returns the serialization of the cookie for use in a Cookie header (if only Name and Value are set)
 * or a Set-Cookie response header (if other fields are set).
 *
 * if name is invalid, the empty string is returned.
 */
export function cookieString(c: Cookie): string {
  if (!isCookieNameValid(c.name)) {
    return "";
  }
  const b = new Array<string>();
  b.push(`${c.name}=${sanitizeCookieValue(c.value)}`);

  if (c.path?.length ?? 0 > 0) {
    b.push(`; Path=${sanitizeCookiePath(c.path!)}`);
  }
  const domain = c.domain;
  if (domain && domain.length > 0) {
    if (validCookieDomain(domain)) {
      // A c.Domain containing illegal characters is not
      // sanitized but simply dropped which turns the cookie
      // into a host-only cookie. A leading dot is okay
      // but won't be sent.
      let d = domain;
      if (d[0] == ".") {
        d = d.substring(1);
      }
      b.push(`; Domain=${d}`);
    } else {
      console.warn(
        `http: invalid Cookie.domain ${domain}; dropping domain attribute`,
      );
    }
  }
  if (validCookieExpires(c.expires)) {
    b.push(`; Expires=${DateTime.fromJSDate(c.expires!).toHTTP()}`);
  }
  if (Number.isSafeInteger(c.maxAge)) {
    if (c.maxAge! > 0) {
      b.push(`; Max-Age=${c.maxAge}`);
    } else if (c.maxAge! <= 0) {
      b.push("; Max-Age=0");
    }
  }
  if (c.httpOnly) {
    b.push("; HttpOnly");
  }
  if (c.secure) {
    b.push("; Secure");
  }
  switch (c.sameSite) {
    case SameSite.DefaultMode:
      // Skip, default mode is obtained by not emitting the attribute.
      break;
    case SameSite.NoneMode:
      b.push("; SameSite=None");
      break;
    case SameSite.LaxMode:
      b.push("; SameSite=Lax");
      break;
    case SameSite.StrictMode:
      b.push("; SameSite=Strict");
      break;
  }
  return b.join("");
}
// validCookieDomain reports whether v is a valid cookie domain-value.
function validCookieDomain(v: string): boolean {
  if (isCookieDomainName(v)) {
    return true;
  }
  if (IP.parse(v) !== undefined && v.indexOf(":") < 0) {
    return true;
  }
  return false;
}
// isCookieDomainName reports whether s is a valid domain name or a valid
// domain name with a leading dot '.'.  It is almost a direct copy of
// package net's isDomainName.
function isCookieDomainName(s: string): boolean {
  if (s.length == 0) {
    return false;
  }
  if (s.length > 255) {
    return false;
  }

  if (s[0] == ".") {
    // A cookie a domain attribute may start with a leading dot.
    s = s.substring(1);
  }
  let last = ".";
  let ok = false; // Ok once we've seen a letter.
  let partlen = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ("a" <= c && c <= "z" || "A" <= c && c <= "Z") {
      // No '_' allowed here (in contrast to package net).
      ok = true;
      partlen++;
    } else if ("0" <= c && c <= "9") {
      // fine
      partlen++;
    } else if (c == "-") {
      // Byte before dash cannot be dot.
      if (last == ".") {
        return false;
      }
      partlen++;
    } else if (c == ".") {
      // Byte before dot cannot be dot, dash.
      if (last == "." || last == "-") {
        return false;
      }
      if (partlen > 63 || partlen == 0) {
        return false;
      }
      partlen = 0;
    } else {
      return false;
    }
    last = c;
  }
  if (last == "-" || partlen > 63) {
    return false;
  }
  return ok;
}
// validCookieExpires reports whether v is a valid cookie expires-value.
function validCookieExpires(t?: Date): boolean {
  if (t === undefined) {
    return false;
  }
  // IETF RFC 6265 Section 5.1.1.5, the year must not be less than 1601
  return t.getFullYear() >= 1601;
}
// path-av           = "Path=" path-value
// path-value        = <any CHAR except CTLs or ";">
function sanitizeCookiePath(v: string): string {
  return sanitizeOrWarn("Cookie.Path", validCookiePathByte, v);
}
function validCookiePathByte(b: string): boolean {
  const v = b.charCodeAt(0);
  return 0x20 <= v && v < 0x7f && b != ";";
}
function sanitizeCookieValue(v: string): string {
  v = sanitizeOrWarn("Cookie.Value", validCookieValueByte, v);
  if (v.length == 0) {
    return v;
  }
  if (v.indexOf(" ") >= 0 || v.indexOf(",") >= 0) {
    return `"${v}"`;
  }
  return v;
}
function validCookieValueByte(b: string): boolean {
  const v = b.charCodeAt(0);
  return 0x20 <= v && v < 0x7f && b != '"' && b != ";" && b != "\\";
}
function sanitizeOrWarn(
  fieldName: string,
  valid: (s: string) => boolean,
  v: string,
): string {
  let ok = true;
  for (const c of v) {
    if (valid(c)) {
      continue;
    }
    console.warn(
      `http: invalid byte c in ${fieldName}; dropping invalid bytes`,
    );
    ok = false;
    break;
  }

  if (ok) {
    return v;
  }
  const buf = new Array<string>();
  for (const c of v) {
    if (valid(c)) {
      continue;
    }
    buf.push(c);
  }
  return buf.join("");
}
function isCookieNameValid(raw: string): boolean {
  if (raw == "") {
    return false;
  }
  for (const c of raw) {
    if (!isTokenRune(c)) {
      return false;
    }
  }
  return true;
}

/**
 * Adds the Set-Cookie header to the provided Response headers
 *
 * @remarks
 * The provided cookie must have a valid Name. Invalid cookies may be silently dropped.
 */
export function setCookies(headers: Headers, ...cookies: Array<Cookie>) {
  for (const c of cookies) {
    const v = cookieString(c);
    if (v !== "") {
      headers.append("Set-Cookie", v);
    }
  }
}

/**
 * readSetCookies parses all "Set-Cookie" values from the header h and returns the successfully parsed Cookies.
 * @param h
 */
export function readSetCookies(h: Headers): Array<Cookie> | undefined {
  if (!h.has("set-cookie")) {
    return;
  }
  let cookies: Array<Cookie> | undefined;
  for (const [k, line] of h) {
    if (k != "set-cookie") {
      continue;
    }
    const parts = textproto.trim(line).split(";");
    if (parts.length == 1 && parts[0] == "") {
      continue;
    }
    parts[0] = textproto.trim(parts[0]);
    const j = parts[0].indexOf("=");
    if (j < 0) {
      continue;
    }
    const name = parts[0].substring(0, j);
    let value: string | undefined = parts[0].substring(j + 1);
    if (!isCookieNameValid(name)) {
      continue;
    }
    value = parseCookieValue(value, true);
    if (value === undefined) {
      continue;
    }

    const c: Cookie = {
      name: name,
      value: value,
      raw: line,
    };
    for (let i = 1; i < parts.length; i++) {
      parts[i] = textproto.trim(parts[i]);
      if (parts[i].length == 0) {
        continue;
      }
      let attr = parts[i];
      let val: string | undefined = "";
      const j = attr.indexOf("=");
      if (j >= 0) {
        val = attr.substring(j + 1);
        attr = attr.substring(0, j);
      }
      const lowerAttr = ascii.toLower(attr);
      if (lowerAttr === undefined) {
        continue;
      }
      val = parseCookieValue(val, false);
      if (val === undefined) {
        if (c.unparsed) {
          c.unparsed.push(parts[i]);
        } else {
          c.unparsed = [parts[i]];
        }
        continue;
      }

      switch (lowerAttr) {
        case "samesite":
          {
            const lowerVal = ascii.toLower(val) ?? "def";
            if (!lowerVal) {
              c.sameSite = SameSite.DefaultMode;
              continue;
            }
            switch (lowerVal) {
              case "lax":
                c.sameSite = SameSite.LaxMode;
                break;
              case "strict":
                c.sameSite = SameSite.StrictMode;
                break;
              case "none":
                c.sameSite = SameSite.NoneMode;
                break;
              default:
                c.sameSite = SameSite.DefaultMode;
                break;
            }
          }
          continue;
        case "secure":
          c.secure = true;
          continue;
        case "httponly":
          c.httpOnly = true;
          continue;
        case "domain":
          c.domain = val;
          continue;
        case "max-age":
          {
            let secs = parseMaxage(val);
            if (secs === undefined) {
              break;
            }
            if (secs <= 0) {
              secs = -1;
            }
            c.maxAge = secs;
          }
          continue;
        case "expires":
          {
            c.rawExpires = val;
            const exptime = DateTime.fromHTTP(val);
            if (!exptime.isValid) {
              break;
            }
            c.expires = exptime.toJSDate();
          }
          continue;
        case "path":
          c.path = val;
          continue;
      }
      if (c.unparsed) {
        c.unparsed.push(parts[i]);
      } else {
        c.unparsed = [parts[i]];
      }
    }
    if (cookies) {
      cookies.push(c);
    } else {
      cookies = [c];
    }
  }
  return cookies;
}
function parseCookieValue(
  raw: string,
  allowDoubleQuote: boolean,
): string | undefined {
  // Strip the quotes, if present.
  if (
    allowDoubleQuote && raw.length > 1 && raw.startsWith('"') &&
    raw.endsWith('"')
  ) {
    raw = raw.substring(1, raw.length - 1);
  }
  for (const c of raw) {
    if (!validCookieValueByte(c)) {
      return;
    }
  }
  return raw;
}
function parseMaxage(s: string): number | undefined {
  let i = 0;
  if (s[0] == "-") {
    i = 1;
  }
  for (; i < s.length; i++) {
    const c = s[i];
    if (c < "0" || c > "9") {
      return;
    }
  }
  const v = parseInt(s);
  if (Number.isSafeInteger(v)) {
    if (v == 0 && s != "0") {
      return;
    }
    return v;
  }
}

/**
 * parses all "Cookie" values from the header h and returns the successfully parsed Cookies.
 *
 * if filter isn't empty, only cookies of that name are returned
 */
export function readCookies(
  h: Headers,
  filter = "",
): Array<Cookie> | undefined {
  return _readCookies(h, filter ?? "", false) as undefined;
}

function _readCookies(
  h: Headers,
  filter: string,
  one: boolean,
): Array<Cookie> | Cookie | undefined {
  if (!h.has("cookie")) {
    return;
  }
  let cookies: Array<Cookie> | undefined;
  for (let [k, line] of h) {
    if (k != "cookie") {
      continue;
    }
    line = textproto.trim(line);
    let part = "";
    while (line.length > 0) {
      const splitIndex = line.indexOf(";");
      if (splitIndex > 0) {
        part = line.substring(0, splitIndex);
        line = line.substring(splitIndex + 1);
      } else {
        part = line;
        line = "";
      }
      part = textproto.trim(part);
      if (part.length == 0) {
        continue;
      }
      let name = part;
      let val: string | undefined = "";
      const j = part.indexOf("=");
      if (j >= 0) {
        val = name.substring(j + 1);
        name = name.substring(0, j);
      }
      if (!isCookieNameValid(name)) {
        continue;
      }
      if (filter != "" && filter != name) {
        continue;
      }
      val = parseCookieValue(val, true);
      if (val === undefined) {
        continue;
      }
      if (cookies) {
        cookies.push({
          name: name,
          value: val,
        });
      } else {
        if (one) {
          return {
            name: name,
            value: val,
          };
        }
        cookies = [{
          name: name,
          value: val,
        }];
      }
    }
  }
  return cookies;
}
/**
 * returns the named cookie provided in the header.
 *
 * If multiple cookies match the given name, only one cookie will
 */
export function cookie(h: Headers, name: string): Cookie | undefined {
  return _readCookies(h, name, true) as undefined;
}

/**
 * Adds Cookie to the provided Request headers.
 *
 * @remarks
 * Per RFC 6265 section 5.4, addCookie does not attach more than one Cookie header field.
 * That means all cookies, if any, are written into the same line, separated by semicolon.
 *
 * addCookie only sanitizes c's name and value, and does not sanitize a Cookie header already present in the header.
 */
export function addCookies(h: Headers, ...cookies: Array<Cookie>): void {
  for (const c of cookies) {
    const s = `${sanitizeCookieName(c.name)}=${sanitizeCookieValue(c.value)}`;
    const str = h.get("cookie") ?? "";
    if (str == "") {
      h.set("cookie", `${c}; ${s}`);
    } else {
      h.set("cookie", s);
    }
  }
}
function sanitizeCookieName(n: string): string {
  return n.replace(/[\n\r]/g, "-");
}
