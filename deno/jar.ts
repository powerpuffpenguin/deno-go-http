import { Context } from "./deps/easyts/context/context.ts";
import { Cookie } from "./cookie.ts";
import { NextHandle } from "./middleware.ts";
import {
  canonicalHost,
  defaultPath,
  domainAndType,
  hasDotSuffix,
  jarKey,
} from "./internal/cookiejar.ts";
import { CookieJar } from "./cookiejar.ts";
import { addCookies, readSetCookies, SameSite } from "./internal/cookie.ts";

// PublicSuffixList provides the public suffix of a domain. For example:
//      - the public suffix of "example.com" is "com",
//      - the public suffix of "foo1.foo2.foo3.co.uk" is "co.uk", and
//      - the public suffix of "bar.pvt.k12.ma.us" is "pvt.k12.ma.us".
//
// Implementations of PublicSuffixList must be safe for concurrent use by
// multiple goroutines.
//
// An implementation that always returns "" is valid and may be useful for
// testing but it is not secure: it means that the HTTP server for foo.com can
// set a cookie for bar.com.
//
// A public suffix list implementation is in the package
// golang.org/x/net/publicsuffix.
export interface PublicSuffixList {
  // PublicSuffix returns the public suffix of domain.
  //
  // TODO: specify which of the caller and callee is responsible for IP
  // addresses, for leading and trailing dots, for case sensitivity, and
  // for IDN/Punycode.
  publicSuffix(domain: string): string;

  // String returns a description of the source of this public suffix
  // list. The description will typically contain something like a time
  // stamp or version number.
  toString(): string;
}
// Options are the options for creating a new Jar.
export interface Options {
  // PublicSuffixList is the public suffix list that determines whether
  // an HTTP server can set a cookie for a domain.
  //
  // A nil value is valid and may be useful for testing but it is not
  // secure: it means that the HTTP server for foo.co.uk can set a cookie
  // for bar.co.uk.
  publicSuffixList?: PublicSuffixList;
}

// entry is the internal representation of a cookie.
//
// This struct type is not used outside of this package per se, but the exported
// fields are those of RFC 6265.
class Entry {
  name = "";
  value = "";
  domain = "";
  path = "";
  sameSite = "";
  secure?: boolean;
  httpOnly?: boolean;
  persistent?: boolean;
  hostOnly?: boolean;
  expires = 0;
  creation = 0;
  lastAccess = 0;

  // seqNum is a sequence number so that Cookies returns cookies in a
  // deterministic order, even for cookies that have equal Path length and
  // equal Creation time. This simplifies testing.
  seqNum = BigInt(0);

  // id returns the domain;path;name triple of e as an id.
  id(): string {
    return `${this.domain};${this.path};${this.name}`;
  }
  // shouldSend determines whether e's cookie qualifies to be included in a
  // request to host/path. It is the caller's responsibility to check if the
  // cookie is expired.
  shouldSend(https: boolean, host: string, path: string): boolean {
    return this.domainMatch(host) && this.pathMatch(path) &&
      (https || !this.secure);
  }
  // domainMatch implements "domain-match" of RFC 6265 section 5.1.3.
  domainMatch(host: string): boolean {
    if (this.domain == host) {
      return true;
    }
    return !this.hostOnly && hasDotSuffix(host, this.domain);
  }
  pathMatch(requestPath: string): boolean {
    if (requestPath == this.path) {
      return true;
    }
    if (requestPath.startsWith(this.path)) {
      if (this.path[this.path.length - 1] == "/") {
        return true; // The "/any/" matches "/any/path" case.
      } else if (requestPath[this.path.length] == "/") {
        return true; // The "/any" matches "/any/path" case.
      }
    }
    return false;
  }
}
// Jar implements the http.CookieJar interface from the net/http package.
export class Jar implements CookieJar {
  private psList_?: PublicSuffixList;

  // entries is a set of entries, keyed by their eTLD+1 and subkeyed by
  // their name/domain/path.
  private entries_ = new Map<string, Map<string, Entry>>();

  // nextSeqNum is the next sequence number assigned to a new cookie
  // created SetCookies.
  private nextSeqNum_ = BigInt(0);
  constructor(opts?: Options) {
    this.psList_ = opts?.publicSuffixList;
  }
  /**
   * returns undefined if the URL.protocol is not HTTP or HTTPS.
   */
  cookies(_: Context, u: URL): Array<Cookie> | undefined {
    return this._cookies(u, Date.now());
  }
  // cookies is like Cookies but takes the current time as a parameter.
  private _cookies(u: URL, now: number): Array<Cookie> | undefined {
    if (u.protocol != "http:" && u.protocol != "https:") {
      return;
    }
    const host = canonicalHost(u.host);
    const key = jarKey(host, this.psList_?.publicSuffix);

    const entries = this.entries_;
    const submap = entries.get(key);
    if (!submap) {
      return;
    }

    const https = u.protocol == "https:";
    let path = u.pathname;
    if (path == "") {
      path = "/";
    }

    let modified = false;
    let selected: Array<Entry> | undefined;
    for (const [id, e] of submap) {
      if (e.persistent && !(e.expires > now)) {
        submap.delete(id);
        modified = true;
        continue;
      }
      if (!e.shouldSend(https, host, path)) {
        continue;
      }

      e.lastAccess = now;
      submap.set(id, e);
      if (selected) {
        selected.push(e);
      } else {
        selected = [e];
      }
      modified = true;
    }
    if (modified) {
      if (submap.size == 0) {
        entries.delete(key);
      } else {
        entries.set(key, submap);
      }
    }
    if (!selected) {
      return;
    }

    // sort according to RFC 6265 section 5.4 point 2: by longest
    // path and then by earliest creation time.
    selected.sort((i, j) => {
      if (i.path != j.path) {
        return (i.path > j.path) ? -1 : 1;
      }
      if (i.creation != j.creation) {
        return i.creation < j.creation ? -1 : 1;
      }
      return i.seqNum < j.seqNum ? -1 : 1;
    });
    return selected.map((e) => {
      return {
        name: e.name,
        value: e.value,
      };
    });
  }
  /**
   * It does nothing if the URL.protocol is not HTTP or HTTPS.
   */
  setCookies(_: Context, u: URL, ...cookies: Array<Cookie>): void {
    this._setCookies(u, cookies, Date.now());
  }
  private _setCookies(u: URL, cookies: Array<Cookie>, now: number): void {
    if (cookies.length == 0) {
      return;
    }
    if (u.protocol != "http:" && u.protocol != "https:") {
      return;
    }
    const host = canonicalHost(u.host);
    const key = jarKey(host, this.psList_?.publicSuffix);
    const defPath = defaultPath(u.pathname);

    const entries = this.entries_;
    let submap = entries.get(key);

    let modified = false;
    for (const cookie of cookies) {
      const [e, remove, err] = this._newEntry(cookie, now, defPath, host);
      if (err) {
        continue;
      }
      const id = e.id();
      if (remove) {
        if (submap) {
          if (submap.has(id)) {
            submap.delete(id);
            modified = true;
          }
        }
        continue;
      }
      if (!submap) {
        submap = new Map<string, Entry>();
      }

      const old = submap.get(id);
      if (old) {
        e.creation = old.creation;
        e.seqNum = old.seqNum;
      } else {
        e.creation = now;
        e.seqNum = this.nextSeqNum_++;
      }
      e.lastAccess = now;
      submap.set(id, e);
      modified = true;
    }

    if (modified) {
      if (submap!.size == 0) {
        entries.delete(key);
      } else {
        entries.set(key, submap!);
      }
    }
  }
  // newEntry creates an entry from a http.Cookie c. now is the current time and
  // is compared to c.Expires to determine deletion of c. defPath and host are the
  // default-path and the canonical host name of the URL c was received from.
  //
  // remove records whether the jar should delete this cookie, as it has already
  // expired with respect to now. In this case, e may be incomplete, but it will
  // be valid to call e.id (which depends on e's Name, Domain and Path).
  //
  // A malformed c.Domain will result in an error.
  private _newEntry(
    c: Cookie,
    now: number,
    defPath: string,
    host: string,
  ): [Entry, boolean, boolean] {
    const e = new Entry();
    e.name = c.name;

    const path = c.path ?? "";
    if (path == "" || path[0] != "/") {
      e.path = defPath;
    } else {
      e.path = path;
    }

    let err = false;
    [e.domain, e.hostOnly, err] = domainAndType(
      host,
      c.domain ?? "",
      this.psList_?.publicSuffix,
    );
    if (err) {
      return [e, false, err];
    }

    // MaxAge takes precedence over Expires.
    const maxAge = c.maxAge ?? 0;
    if (maxAge < 0) {
      return [e, true, err];
    } else if (maxAge > 0) {
      e.expires = now + maxAge * 1000;
      e.persistent = true;
    } else {
      const d = c.expires;
      if (d === undefined) {
        e.expires = Number.MAX_SAFE_INTEGER;
        e.persistent = false;
      } else {
        const expires = d.getTime();
        if (expires <= now) {
          return [e, true, false];
        }
        e.expires = expires;
        e.persistent = true;
      }
    }

    e.value = c.value;
    e.secure = c.secure;
    e.httpOnly = c.httpOnly;

    switch (c.sameSite) {
      case SameSite.NoneMode:
        e.sameSite = "SameSite";
        break;
      case SameSite.StrictMode:
        e.sameSite = "SameSite=Strict";
        break;
      case SameSite.LaxMode:
        e.sameSite = "SameSite=Lax";
        break;
    }

    return [e, false, false];
  }
}

export function createJar(jar: Jar) {
  return async (
    ctx: Context,
    url: URL,
    req: Request,
    next: NextHandle,
  ) => {
    // add cookie to request
    const cookies = await jar.cookies(ctx, url);
    if (cookies) {
      addCookies(req.headers, ...cookies);
    }
    const resp = await next(ctx, url, req);

    // update set-cookies to jar
    const sets = readSetCookies(resp.headers);
    if (sets) {
      await jar.setCookies(ctx, url, ...sets);
    }

    return resp;
  };
}
