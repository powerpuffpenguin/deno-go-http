import { Context } from "./deps/easyts/context.ts";
import { Cookie } from "./cookie.ts";
export interface CookieJar {
  /**
   * SetCookies handles the receipt of the cookies in a reply for the
   * given URL.  It may or may not choose to save the cookies, depending
   * on the jar's policy and implementation.
   */
  setCookies(
    ctx: Context,
    u: URL,
    ...cookies: Array<Cookie>
  ): void | Promise<void>;

  /**
   * Cookies returns the cookies to send in a request for the given URL.
   * It is up to the implementation to honor the standard cookie use
   * restrictions such as in RFC 6265.
   */
  cookies(
    ctx: Context,
    u: URL,
  ): (Array<Cookie> | undefined) | Promise<Array<Cookie> | undefined>;
}
