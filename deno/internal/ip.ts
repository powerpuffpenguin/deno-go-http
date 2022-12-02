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
export function isIPv4(s: string): boolean {
  for (let i = 0; i < IPv4len; i++) {
    if (s.length == 0) {
      // Missing octets.
      return false;
    }
    if (i > 0) {
      if (s[0] != ".") {
        return false;
      }
      s = s.substring(1);
    }
    const [n, c, ok] = dtoi(s);
    if (!ok || n > 0xFF) {
      return false;
    }
    if (c > 1 && s[0] == "0") {
      // Reject non-zero components with leading zeroes.
      return false;
    }
    s = s.substring(c);
  }
  if (s.length != 0) {
    return false;
  }
  return true;
}
export function isIPv6(s: string): boolean {
  let ellipsis = -1; // position of ellipsis in ip

  // Might have leading ellipsis
  if (s.length >= 2 && s[0] == ":" && s[1] == ":") {
    ellipsis = 0;
    s = s.substring(2);
    // Might be only ellipsis
    if (s.length == 0) {
      return true;
    }
  }

  // Loop, parsing hex numbers followed by colon.
  let i = 0;
  while (i < IPv6len) {
    // Hex number.
    const [n, c, ok] = xtoi(s);
    if (!ok || n > 0xFFFF) {
      return false;
    }

    // If followed by dot, might be in trailing IPv4.
    if (c < s.length && s[c] == ".") {
      if (ellipsis < 0 && i != IPv6len - IPv4len) {
        // Not the right place.
        return false;
      }
      if (i + IPv4len > IPv6len) {
        // Not enough room.
        return false;
      }
      if (!isIPv4(s)) {
        return false;
      }
      s = "";
      i += IPv4len;
      break;
    }

    // Save this 16-bit chunk.
    i += 2;

    // Stop at end of string.
    s = s.substring(c);
    if (s.length == 0) {
      break;
    }

    // Otherwise must be followed by colon and more.
    if (s[0] != ":" || s.length == 1) {
      return false;
    }
    s = s.substring(1);
    // Look for ellipsis.
    if (s[0] == ":") {
      if (ellipsis >= 0) { // already have one
        return false;
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
    return false;
  }

  // If didn't parse enough, expand ellipsis.
  if (i < IPv6len) {
    if (ellipsis < 0) {
      return false;
    }
  } else if (ellipsis >= 0) {
    // Ellipsis must represent at least one 0 group.
    return false;
  }
  return true;
}
export function isIP(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    switch (s[i]) {
      case ".":
        return isIPv4(s);
      case ":": {
        return isIPv6(s);
      }
    }
  }
  return false;
}
