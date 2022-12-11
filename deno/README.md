# deno-go-http

deno's http client library

The fetch api is very useful, but for the client, some functions such as
cookiejar middleware are needed, so I developed this library

# Features

- Consistent with fetch api usage
- With the help of the [easyts](https://github.com/powerpuffpenguin/easyts)
  library, it supports the Context interface of golang
- Ported cookie and cookiejar according to golang standard library
- Supports middleware, which can be used to set token retry requests, etc.

# Index

- [quick start](#quick-start)
  - [constructor](#constructor)
- [context](#context) timeout and deadline
- [cookiejar](#cookiejar)
- [middleware](#middleware)

# quick-start

You need to create an instance of Client and specify some job details (such as
cookiejar and middleware), or simply use the default settings

```
import { Client } from "https://deno.land/x/gohttp/mod.ts";

const c = new Client();
```

client provides a fetch function, its usage is almost the same as that of
webapi's fetch

```
class Client{
  fetch(input: string | URL | Request, init?: FetchInit): Promise<Response>
}

export interface FetchInit extends RequestInit {
  /**
   * like golang context
   */
  context?: Context;
  /**
   * base url
   */
  url?: URL;
  /**
   * query params
   */
  search?:
    | string[][]
    | Record<string, string>
    | string
    | URLSearchParams;
  /**
   * if has body set context-type
   */
  contextType?: string;
}
```

As you can see, FetchInit is derived from RequestInit so you can use
Client.fetch according to the fetch experience

Additionally FetchInit extends several optional parameters:

- **context** Similar to golang's context, you can use it to control request
  cancellation or timeout
- **url** Set a base url for the requested url, which will eventually call new
  URL(input, url)
- **search** Set the query parameter in the request url to this value
- **contextType** If the request sets the body, set context-type to this value
  in the header

Finally, the client still provides several shortcut functions, which will
automatically set the method attribute of the request

```
class Client{
  get(input: string | URL | Request, init?: FetchInit): Promise<Response>
  head(input: string | URL | Request, init?: FetchInit): Promise<Response>
  delete(input: string | URL | Request, init?: FetchInit): Promise<Response>
  post(input: string | URL | Request, init?: FetchInit): Promise<Response>
  put(input: string | URL | Request, init?: FetchInit): Promise<Response>
  patch(input: string | URL | Request, init?: FetchInit): Promise<Response>
}
```

# constructor

The Client constructor accepts an optional parameter ClientOptions

```
export interface ClientOptions {
  /**
   * Similar to RequestInit but without body and window properties, can set some default values for all requests
   */
  readonly init?: FetchInit;
  /**
   * If set will automatically handle cookies for the client
   */
  readonly jar?: CookieJar;
  /**
   * An interceptor, all requests will call the implementation here, you can replace the underlying fetch or implement middleware here
   */
  readonly fetch?: (
    ctx: Context,
    url: URL,
    request: Request,
  ) => Promise<Response>;
}
```

# context

Client supports golang's Context, you can easily set a timeout for the request
or cancel the request

> The usage of Context is exactly the same as that of golang, please refer to
> the documentation of golang. In addition, the Context and Chan use the
> third-party library [easyts](https://github.com/powerpuffpenguin/easyts)

```
import { Client } from "https://deno.land/x/gohttp/mod.ts";
import { background, errDeadlineExceeded } from "https://deno.land/x/gohttp/deps/easyts/context/context.ts";

// You can also set a deadline using withDeadline
const ctx = background().withTimeout(1000); // timeout 1s

try {
  await new Client().get("http://192.168.0.2:9000", {
    context: ctx,
  });
} catch (e) {
  console.log(e.timeout);
  console.log(e.message);
}
```

# cookiejar

This library transplants Cookie and CookieJar in the golang standard library,
and defines a CookieJar interface supported by Client. You can directly use the
transplanted class Jar or implement CookieJar yourself to support cookies

```
import { Client, Jar } from "https://deno.land/x/gohttp/mod.ts";

new Client({
  jar: new Jar(), // Specifies the cookiejar implementation for the client
});
```

Below is the CookieJar interface definition:

```
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
```

In addition, some cookie reading and writing related functions transplanted from
golang are provided:

- cookieString
- addCookies
- readCookie
- readCookies
- readSetCookies
- setCookies

# middleware

Middleware is a Handle function or Middleware interface.

Call createMiddleware to set the middleware and set the return value to the
fetch interceptor of Client, and the middleware will take effect:

```
import { Client, createMiddleware, logger } from "https://deno.land/x/gohttp/mod.ts";

new Client({
  fetch: createMiddleware(
    // This middleware will print the time spent from request to response and has responded to status
    logger,
    // implement a middleware
    async (ctx, url, req, next) => {
      if (ctx.isClosed) { // The request has exceeded the deadline or was canceled by other callers
        // throws an error
        throw ctx.err;
      }
      // Perform some operations before sending the request
      // ...

      // Execute the next middleware
      const resp = await next(ctx, url, req);

      // Perform some actions after receiving the response
      // ...

      // return request result
      return resp;
    },
    // Set up more middleware
    // ...
  ),
});
```
