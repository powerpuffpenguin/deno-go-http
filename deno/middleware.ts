import { Context } from "./deps/easyts/context/context.ts";
import { log } from "./log.ts";
import { _ } from "./status.ts";
export type NextHandle = (
  ctx: Context,
  url: URL,
  req: Request,
) => Promise<Response>;

export type Handle = (
  ctx: Context,
  url: URL,
  req: Request,
  next: NextHandle,
) => Promise<Response>;

export interface Middleware {
  fetch(
    ctx: Context,
    url: URL,
    req: Request,
    next: NextHandle,
  ): Promise<Response>;
}
class _Element {
  next?: _Element;
  constructor(
    public readonly handle: Handle | Middleware,
  ) {}

  fetch(ctx: Context, url: URL, req: Request): Promise<Response> {
    const h = this.handle;
    const next = this.next;

    const f = next === undefined
      ? (_: Context, __: URL, req: Request) => fetch(req)
      : (ctx: Context, url: URL, req: Request) => next.fetch(ctx, url, req);

    return typeof h === "function"
      ? h(ctx, url, req, f)
      : h.fetch(ctx, url, req, f);
  }
}
/**
 * Similar to the createMiddleware function, but also replaces the underlying fetch function with a function f
 */
export function createMiddlewareWithFetch(
  f: (ctx: Context, url: URL, req: Request) => Promise<Response>,
  ...middleware: Array<Handle | Middleware>
): NextHandle {
  return ((ctx, url, request) => {
    if (middleware.length == 0) {
      return f(ctx, url, request);
    }
    let root: _Element | undefined;
    let pre: _Element | undefined;
    for (const m of middleware) {
      const c = new _Element(m);
      if (pre) {
        pre.next = c;
      } else {
        root = c;
      }
      pre = c;
    }
    return root!.fetch(ctx, url, request);
  });
}
/**
 * Returns an interceptor that will call the middleware in the order of the array
 *
 * @remarks
 * Middleware is called sequentially before the request is sent to the network, and destroyed in reverse order after the response
 */
export function createMiddleware(
  ...middleware: Array<Handle | Middleware>
): NextHandle {
  return createMiddlewareWithFetch((_, __, req) => fetch(req), ...middleware);
}
const Millisecond = 1;
const Second = Millisecond * 1000;
const Minute = Second * 60;
const Hour = Minute * 60;
const Day = Hour * 24;
function duration(v: number, m: number): [number, number] {
  let d = 0;
  if (v >= m) {
    d = Math.floor(v / m);
    v %= m;
  }
  return [d, v];
}
const usedDefine = [
  {
    name: "day",
    val: Day,
  },
  {
    name: "h",
    val: Hour,
  },
  {
    name: "m",
    val: Minute,
  },
  {
    name: "s",
    val: Second,
  },
  {
    name: "ms",
    val: Millisecond,
  },
];
function used(v: number): string {
  const strs = new Array<string>();
  let d = 0;
  for (const ele of usedDefine) {
    [d, v] = duration(v, ele.val);
    if (d > 0) {
      strs.push(`${d}${ele.name}`);
    }
  }
  return strs.length == 0 ? "0ms" : strs.join("");
}
/**
 * This middleware will use console.log to print all request execution
 */
export async function logger(
  ctx: Context,
  url: URL,
  req: Request,
  next: NextHandle,
): Promise<Response> {
  const at = Date.now();
  try {
    const resp = await next(ctx, url, req);
    log.info(
      `${req.method} ${req.url} [${
        used(Date.now() - at)
      }] completed: ${resp.status} ${resp.statusText}`,
    );
    return resp;
  } catch (e) {
    log.info(
      `${req.method} ${req.url} [${used(Date.now() - at)}] error:`,
      e,
    );
    throw e;
  }
}

/**
 * Create a middleware that will delay all requests for a period of time before sending them out
 */
export function createDelay(ms: number): Handle {
  return (async (ctx, url, req, next) => {
    await ctx.sleep(ms);
    if (ctx.isClosed) {
      throw ctx.err;
    }
    return next(ctx, url, req);
  });
}
