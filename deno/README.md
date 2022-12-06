# deno-go-http

deno's golang style http client library

This is a golang-style deno http client library. why goalng? Because I think
deno is similar to golang in some places and I am obsessed with golang. I have
been looking for a script that is as comfortable as writing golang until I found
deno.

# Features

- Simple to use, the api is similar to the original fetch api
- With the help of the [easyts](https://github.com/powerpuffpenguin/easyts)
  library, it supports the Context interface of golang, which can be operated
  together with chan select, etc.(Thanks to function overloading you can also
  ignore Context and use js original AbortController)
- Define and support Cookiejar interface (a class Jar that implements the
  interface is provided, and you can also implement it yourself)
- Supports middleware, which can be used to set token retry requests, etc.

# Index

- [quick start](#quick-start)
  - [constructor](#constructor)
- [context](#context) timeout and deadline
- [cookiejar](#cookiejar)
- [middleware](#middleware)

# quick-start

You have to instantiate a class Client, which encapsulates all the internal
trivialities of replication and only develops a simple and easy-to-use interface

```
import { Client } from "https://deno.land/x/gohttp/mod.ts";

const c = new Client();
```

Now you can use the do method to send the request, which is similar to the
parameters that fetch receives

```
const resp:Response = await c.do('https://deno.land/')
```

In addition, the client provides several shortcut functions

```
c.get(url)
c.get(url,search)

c.post(url)
c.post(url,body)
c.post(url,body,contextType)
```

- Client also provides delete head two functions, their usage is exactly the
  same as get
- Client also provides put patch two functions, their usage is exactly the same
  as post

# constructor

The constructor of Client can accept a url as the baseurl for all requests:

```
new Client("https://deno.land/)
```

In addition, a ClientOptions can also be accepted to accept more detailed
settings:

```
export interface ClientOptions {
  /**
   * All request's parent Context
   */
  readonly ctx?: Context;
  /**
   * If the requested url is not an absolute path, use this as baseurl
   *
   * new URL(url,baseURL)
   */
  readonly baseURL?: URL | string;
  /**
   * Similar to RequestInit but without body and window properties, can set some default values for all requests
   */
  readonly init?: ClientInit;
  /**
   * If set will automatically handle cookies for the client
   */
  readonly jar?: CookieJar;
  /**
   * An interceptor, all requests will call the implementation here, you can replace the underlying fetch or implement middleware here
   */
  readonly fetch?: (
    ctx: Context,
    request: Request,
  ) => Promise<Response>;
}
```

# context

The function provided by Client can set the first incoming parameter as Context,
which can simply send a request with a timeout or deadline

> The usage of Context is exactly the same as that of golang, please refer to
> the documentation of golang. In addition, the Context and Chan use the
> third-party library [easyts](https://github.com/powerpuffpenguin/easyts)

```
import { Client } from "https://deno.land/x/gohttp/mod.ts";
import { background, errDeadlineExceeded } from "https://deno.land/x/gohttp/deps/easyts/context.ts";

// You can also set a deadline using withDeadline
const ctx = background().withTimeout(1000); // timeout 1s

try {
  await new Client().get(ctx, "http://192.168.0.2:9000");
} catch (e) {
  console.log(errDeadlineExceeded.is(e));
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
    async (ctx, req, next) => {
      if (ctx.isClosed) { // The request has exceeded the deadline or was canceled by other callers
        // throws an error
        throw ctx.err;
      }
      // Perform some operations before sending the request
      // ...

      // Execute the next middleware
      const resp = await next(ctx, req);

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
