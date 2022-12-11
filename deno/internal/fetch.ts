// deno-lint-ignore-file no-explicit-any
import { selectChan } from "../deps/easyts/channel.ts";
import {
  background,
  CancelContext,
  Context,
} from "../deps/easyts/context/context.ts";
import { Method } from "../method.ts";
const defaultValue: any = {};
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
  /**
   * Set UserAgent in headers
   */
  userAgent?: string;
}
export function createInit(
  init?: FetchInit,
  def?: FetchInit,
  method?: string,
  req = false,
): RequestInit {
  method = method ?? init?.method ?? def?.method;
  let body: BodyInit | null | undefined;
  switch (method ?? Method.Get) {
    case Method.Get:
    case Method.Head:
      break;
    default:
      body = init?.body ?? def?.body;
      break;
  }
  const {
    cache,
    credentials,
    integrity,
    keepalive,
    mode,
    redirect,
    referrer,
    referrerPolicy,
    window,
  } = init ?? def ?? defaultValue;
  let headers: HeadersInit | undefined;
  if (req) {
    headers = init?.headers ?? def?.headers;
  } else {
    headers = init?.headers;
    if (headers) {
      const src = def?.headers;
      if (src) {
        const h = new Headers(headers);
        const s = new Headers(src);
        for (const [k, v] of s) {
          if (!h.has(k)) {
            h.set(k, v);
          }
        }
        headers = h;
      }
    } else {
      headers = def?.headers;
    }
  }
  return {
    body,
    cache,
    credentials,
    headers,
    integrity,
    keepalive,
    method,
    mode,
    redirect,
    referrer,
    referrerPolicy,
    window,
  };
}

export function createFetch(
  input: string | URL | Request,
  init?: FetchInit,
  def?: FetchInit,
  method?: Method,
): Fetch {
  const ctx = background().withCancel();
  try {
    listenContext(ctx, init?.context, def?.context);
    let url: URL;
    let req: RequestInit;
    if (input instanceof Request) {
      listenSignal(ctx, input.signal);
      req = createInit(createInit(input as any, init, method, true), def);
      url = new URL(input.url, init?.url ?? def?.url);
    } else {
      listenSignal(ctx, init?.signal ?? def?.signal);
      req = createInit(init, def, method);
      url = typeof input === "string"
        ? new URL(input, init?.url ?? def?.url)
        : input;
    }
    const search = init?.search ?? def?.search;
    if (search) {
      url.search = new URLSearchParams(search).toString();
    }
    return new Fetch(
      ctx,
      url,
      req,
      init?.contextType ?? def?.contextType,
      init?.userAgent ?? def?.userAgent,
    );
  } catch (e) {
    ctx.cancel();
    throw e;
  }
}
function listenContext(c0: CancelContext, ...ctx: Array<Context | undefined>) {
  if (c0.isClosed) {
    throw c0.err;
  }
  for (const c1 of ctx) {
    if (!c1) {
      continue;
    }
    if (c1.isClosed) {
      c0.cancel(c1.err);
      break;
    }
    waitContext(c0, c1);
  }
}
async function waitContext(c0: CancelContext, c1: Context) {
  const r = c1.done.readCase();
  if (r == await selectChan(c0.done.readCase(), r)) {
    c0.cancel(c1.err);
  }
}
function listenSignal(
  c0: CancelContext,
  ...signal: Array<null | undefined | AbortSignal>
) {
  if (c0.isClosed) {
    throw c0.err;
  }
  for (const s of signal) {
    if (!s) {
      continue;
    }
    if (s.aborted) {
      c0.cancel(s.reason);
      break;
    }
    waitSignal(c0, s);
  }
}
async function waitSignal(c0: CancelContext, s: AbortSignal) {
  const l = () => {
    c0.cancel(s.reason);
  };

  s.addEventListener("abort", l);
  await c0.done.read();
  s.removeEventListener("abort", l);
}
// user-agent
export class Fetch {
  readonly abort = new AbortController();
  public readonly request: Request;
  constructor(
    public readonly ctx: CancelContext,
    public readonly url: URL,
    init: RequestInit,
    public readonly contextType?: string,
    public readonly userAgent?: string,
  ) {
    init.signal = this.abort.signal;
    this.request = new Request(url, init);
  }
  cancel() {
    this.ctx.cancel();
  }
  done() {
    return this.ctx.done;
  }
}
