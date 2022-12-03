import { Context } from "../deps/easyts/context.ts";
type NextHandle = (ctx: Context, request: Request) => Promise<Response>;

export type Handle = (
  ctx: Context,
  request: Request,
  next: NextHandle,
) => Promise<Response>;

export interface Middleware {
  fetch(
    ctx: Context,
    request: Request,
    next: NextHandle,
  ): Promise<Response>;
}
class _Element {
  next?: _Element;
  constructor(
    public readonly handle: Handle | Middleware,
  ) {}

  fetch(ctx: Context, request: Request): Promise<Response> {
    const h = this.handle;
    const next = this.next;

    const f = next === undefined
      ? (_: Context, req: Request) => fetch(req)
      : (ctx: Context, req: Request) => next.fetch(ctx, req);

    return typeof h === "function"
      ? h(ctx, request, f)
      : h.fetch(ctx, request, f);
  }
}
export function createMiddleware(
  ...middleware: Array<Handle | Middleware>
): NextHandle {
  return ((ctx, request) => {
    if (middleware.length == 0) {
      return fetch(request);
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
    return root!.fetch(ctx, request);
  });
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
  req: Request,
  next: NextHandle,
): Promise<Response> {
  const at = Date.now();
  try {
    const resp = await next(ctx, req);
    console.log(
      `${req.method} ${req.url} [${
        used(Date.now() - at)
      }] completed: ${resp.status} ${resp.statusText}`,
    );
    return resp;
  } catch (e) {
    console.log(
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
  return (async (ctx, req, next) => {
    await ctx.sleep(ms);
    if (ctx.isClosed) {
      throw ctx.err;
    }
    return next(ctx, req);
  });
}
