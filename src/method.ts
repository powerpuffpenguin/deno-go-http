/**
 * Common HTTP methods.
 *
 * @remarks
 * Unless otherwise noted, these are defined in RFC 7231 section 4.3.
 */
export enum Method {
  Get = "GET",
  Head = "HEAD",
  Post = "POST",
  Put = "PUT",
  Patch = "PATCH", // RFC 5789
  Delete = "DELETE",
  Connect = "CONNECT",
  Options = "OPTIONS",
  Trace = "TRACE",
}
