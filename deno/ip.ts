export const IPv4len = 4;
export const IPv6len = 16;
// Bigger than we need, not too big to worry about overflow
const big = 0xFFFFFF;

// Decimal to integer.
// Returns number, characters consumed, success.
function dtoi(s: string): [number, number, boolean] {
  let n = 0;
  let i = 0;
  for (i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (!(48 <= code && code <= 57)) {
      break;
    }

    n = n * 10 + (code - 48);
    if (n >= big) {
      return [big, i, false];
    }
  }
  if (i == 0) {
    return [0, 0, false];
  }
  return [n, i, true];
}
// Hexadecimal to integer.
// Returns number, characters consumed, success.
function xtoi(s: string): [number, number, boolean] {
  let n = 0;
  let i = 0;
  for (i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (48 <= c && c <= 57) { // '0' <= s[i] && s[i] <= '9'
      n *= 16;
      n += c - 48;
    } else if (97 <= c && c <= 102) { // 'a' <= s[i] && s[i] <= 'f'
      n *= 16;
      n += c - 97 + 10;
    } else if (65 <= c && c <= 70) { // 'A' <= s[i] && s[i] <= 'F'
      n *= 16;
      n += c - 65 + 10;
    } else {
      break;
    }
    if (n >= big) {
      return [0, i, false];
    }
  }
  if (i == 0) {
    return [0, i, false];
  }
  return [n, i, true];
}
function parseIPv4(s: string): IP | undefined {
  const p = new Uint8Array(IPv4len);
  for (let i = 0; i < IPv4len; i++) {
    if (s.length == 0) {
      // Missing octets.
      return undefined;
    }
    if (i > 0) {
      if (s[0] != ".") {
        return undefined;
      }
      s = s.substring(1);
    }
    const [n, c, ok] = dtoi(s);
    if (!ok || n > 0xFF) {
      return undefined;
    }
    if (c > 1 && s[0] == "0") {
      // Reject non-zero components with leading zeroes.
      return undefined;
    }
    s = s.substring(c);
    p[i] = n;
  }
  if (s.length != 0) {
    return;
  }
  return IP.v4(p[0], p[1], p[2], p[3]);
}
// parseIPv6 parses s as a literal IPv6 address described in RFC 4291
// and RFC 5952.
function parseIPv6(s: string): Uint8Array | undefined {
  const ip = new Uint8Array(IPv6len);
  let ellipsis = -1; // position of ellipsis in ip

  // Might have leading ellipsis
  if (s.length >= 2 && s[0] == ":" && s[1] == ":") {
    ellipsis = 0;
    s = s.substring(2);
    // Might be only ellipsis
    if (s.length == 0) {
      return ip;
    }
  }

  // Loop, parsing hex numbers followed by colon.
  let i = 0;
  while (i < IPv6len) {
    // Hex number.
    const [n, c, ok] = xtoi(s);
    if (!ok || n > 0xFFFF) {
      return;
    }

    // If followed by dot, might be in trailing IPv4.
    if (c < s.length && s[c] == ".") {
      if (ellipsis < 0 && i != IPv6len - IPv4len) {
        // Not the right place.
        return;
      }
      if (i + IPv4len > IPv6len) {
        // Not enough room.
        return;
      }
      const ip4 = parseIPv4(s);
      if (ip4 === undefined) {
        return;
      }
      ip[i] = ip4.ip[12];
      ip[i + 1] = ip4.ip[13];
      ip[i + 2] = ip4.ip[14];
      ip[i + 3] = ip4.ip[15];
      s = "";
      i += IPv4len;
      break;
    }

    // Save this 16-bit chunk.
    ip[i] = n >>> 8;
    ip[i + 1] = n;
    i += 2;

    // Stop at end of string.
    s = s.substring(c);
    if (s.length == 0) {
      break;
    }

    // Otherwise must be followed by colon and more.
    if (s[0] != ":" || s.length == 1) {
      return;
    }
    s = s.substring(1);

    // Look for ellipsis.
    if (s[0] == ":") {
      if (ellipsis >= 0) { // already have one
        return;
      }
      ellipsis = i;
      s = s.substring(1);
      if (s.length == 0) { // can be at end
        break;
      }
    }
  }

  // Must have used entire string.
  if (s.length != 0) {
    return;
  }

  // If didn't parse enough, expand ellipsis.
  if (i < IPv6len) {
    if (ellipsis < 0) {
      return;
    }
    const n = IPv6len - i;
    for (let j = i - 1; j >= ellipsis; j--) {
      ip[j + n] = ip[j];
    }
    for (let j = ellipsis + n - 1; j >= ellipsis; j--) {
      ip[j] = 0;
    }
  } else if (ellipsis >= 0) {
    // Ellipsis must represent at least one 0 group.
    return;
  }
  return ip;
}
const hexDigit = "0123456789abcdef";
function hexString(b: Uint8Array): string {
  const s = new Array<string>(b.length * 2);
  for (let i = 0; i < b.length; i++) {
    const tn = b[i];
    s[i * 2] = hexDigit[tn >>> 4];
    s[i * 2 + 1] = hexDigit[tn & 0xf];
  }
  return s.join("");
}
// ubtoa encodes the string form of the integer v to dst[start:] and
// returns the number of bytes written to dst. The caller must ensure
// that dst has sufficient length.
function ubtoa(dst: Array<string>, start: number, v: number): number {
  if (v < 10) {
    dst[start] = String.fromCharCode(v + 48); // v+ '0'
    return 1;
  } else if (v < 100) {
    dst[start + 1] = String.fromCharCode(v % 10 + 48); // v%10 + '0'
    dst[start] = String.fromCharCode(Math.floor(v / 10) + 48); // v/10 + '0'
    return 2;
  }

  dst[start + 2] = String.fromCharCode(v % 10 + 48); // v%10 + '0'
  dst[start + 1] = String.fromCharCode(Math.floor((v / 10) % 10) + 48); // (v/10)%10 + '0'
  dst[start] = String.fromCharCode(Math.floor(v / 100) + 48); // v/100 + '0'
  return 3;
}
export class IP {
  private constructor(public readonly ip: Uint8Array) {}
  static v4bcast = IP.v4(255, 255, 255, 255); // limited broadcast
  static v4allsys = IP.v4(224, 0, 0, 1); // all systems
  static v4allrouter = IP.v4(224, 0, 0, 2); // all routers
  static v4zero = IP.v4(0, 0, 0, 0); // all zeros

  static v6zero = new IP(
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  );
  static v6unspecified = new IP(
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  );
  static v6loopback = new IP(
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  );
  static v6interfacelocalallnodes = new IP(
    new Uint8Array([0xff, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01]),
  );
  static v6linklocalallnodes = new IP(
    new Uint8Array([0xff, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01]),
  );
  static v6linklocalallrouters = new IP(
    new Uint8Array([0xff, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02]),
  );

  /**
   * returns the IP address (in 16-byte form) of the IPv4 address a.b.c.d.
   */
  static v4(a: number, b: number, c: number, d: number): IP {
    const p = new Uint8Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0xff,
      0xff,
      0,
      0,
      0,
      0,
    ]);
    p[12] = a;
    p[13] = b;
    p[14] = c;
    p[15] = d;
    return new IP(p);
  }
  /**
   * parses s as an IP address, returning the result.
   * @remarks
   * The string s can be in IPv4 dotted decimal ("192.0.2.1"), IPv6 ("2001:db8::68"), or IPv4-mapped IPv6 ("::ffff:192.0.2.1") form.
   * If s is not a valid textual representation of an IP address, parse returns nil.
   */
  static parse(s: string): IP | undefined {
    for (let i = 0; i < s.length; i++) {
      switch (s[i]) {
        case ".":
          return parseIPv4(s);
        case ":": {
          const data = parseIPv6(s);
          return data === undefined ? undefined : new IP(data);
        }
      }
    }
    return;
  }

  /**
   * converts the IPv4 address ip to a 4-byte representation.
   * @remarks
   * If ip is not an IPv4 address, To4 returns nil.
   */
  to4(): IP | undefined {
    const ip = this.ip;
    if (ip.length == IPv4len) {
      return this;
    }
    if (
      ip.length == IPv6len &&
      ip[10] == 0xff &&
      ip[11] == 0xff
    ) {
      for (let i = 0; i < 10; i++) {
        if (ip[i] != 0) {
          break;
        }
      }
      return new IP(ip.subarray(12, 16));
    }
    return;
  }

  /**
   * converts the IP address ip to a 16-byte representation.
   * @remarks
   * If ip is not an IP address (it is the wrong length), to16 returns undefined.
   */
  to16(): IP | undefined {
    const ip = this.ip;
    if (ip.length == IPv4len) {
      return IP.v4(ip[0], ip[1], ip[2], ip[3]);
    }
    if (ip.length == IPv6len) {
      return this;
    }
    return;
  }

  // String returns the string form of the IP address ip.
  // It returns one of 4 forms:
  //   - "<nil>", if ip has length 0
  //   - dotted decimal ("192.0.2.1"), if ip is an IPv4 or IP4-mapped IPv6 address
  //   - IPv6 ("2001:db8::1"), if ip is a valid IPv6 address
  //   - the hexadecimal form of ip, without punctuation, if no other cases apply
  toString(): string {
    const p = this.ip;

    if (p.length == 0) {
      return "<undefined>";
    }

    // If IPv4, use dotted notation.
    const p4 = this.to4()?.ip;
    if (p4?.length == IPv4len) {
      const maxIPv4StringLen = "255.255.255.255".length;
      const b = new Array<string>(maxIPv4StringLen);

      let n = ubtoa(b, 0, p4[0]);
      b[n] = ".";
      n++;

      n += ubtoa(b, n, p4[1]);
      b[n] = ".";
      n++;

      n += ubtoa(b, n, p4[2]);
      b[n] = ".";
      n++;

      n += ubtoa(b, n, p4[3]);
      return b.join("");
    }
    if (p.length != IPv6len) {
      return "?" + hexString(this.ip);
    }

    // Find longest run of zeros.
    let e0 = -1;
    let e1 = -1;
    for (let i = 0; i < IPv6len; i += 2) {
      let j = i;
      while (j < IPv6len && p[j] == 0 && p[j + 1] == 0) {
        j += 2;
      }
      if (j > i && j - i > e1 - e0) {
        e0 = i;
        e1 = j;
        i = j;
      }
    }
    // The symbol "::" MUST NOT be used to shorten just one 16 bit 0 field.
    if (e1 - e0 <= 2) {
      e0 = -1;
      e1 = -1;
    }

    const maxLen = "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff".length;
    const b = new Array<string>(maxLen);
    let offset = 0;
    // Print with possible :: in place of run of zeros
    for (let i = 0; i < IPv6len; i += 2) {
      if (i == e0) {
        b[offset++] = ":";
        b[offset++] = ":";
        i = e1;
        if (i >= IPv6len) {
          break;
        }
      } else if (i > 0) {
        b[offset++] = ":";
      }

      // 	b = appendHex(b, (uint32(p[i])<<8)|uint32(p[i+1]))
      const val = ((p[i] << 8) | (p[i + 1])) & 0xFFFFFFFF;
      if (val == 0) {
        b[offset++] = "0";
      } else {
        for (let j = 7; j >= 0; j--) {
          const v = val >>> j * 4;
          if (v > 0) {
            b[offset++] = hexDigit[v & 0xf];
          }
        }
      }
    }
    return b.join("");
  }
}
