// deno-lint-ignore-file no-explicit-any
import { background, CancelContext, Context } from "./deps/easyts/context.ts";
import { Chan, selectChan } from "./deps/easyts/core/channel.ts";
import { Method } from "./method.ts";
import { addCookies, readSetCookies } from "./cookie.ts";
import { CookieJar } from "./cookiejar.ts";
import { MimeForm } from "./mime.ts";
export type LikeURLSearchParams =
  | string[][]
  | Record<string, string>
  | string
  | URLSearchParams;
export type LikeURL = string | URL;
export type LikeBodyInit = BodyInit | null;
export interface ClientInit {
  /**
   * A string indicating how the request will interact with the browser's cache
   * to set request's cache.
   */
  cache?: RequestCache;
  /**
   * A string indicating whether credentials will be sent with the request
   * always, never, or only when sent to a same-origin URL. Sets request's
   * credentials.
   */
  credentials?: RequestCredentials;
  /**
   * A Headers object, an object literal, or an array of two-item arrays to set
   * request's headers.
   */
  headers?: HeadersInit;
  /**
   * A cryptographic hash of the resource to be fetched by request. Sets
   * request's integrity.
   */
  integrity?: string;
  /**
   * A boolean to set request's keepalive.
   */
  keepalive?: boolean;
  /**
   * A string to set request's method.
   */
  method?: string;
  /**
   * A string to indicate whether the request will use CORS, or will be
   * restricted to same-origin URLs. Sets request's mode.
   */
  mode?: RequestMode;
  /**
   * A string indicating whether request follows redirects, results in an error
   * upon encountering a redirect, or returns the redirect (in an opaque
   * fashion). Sets request's redirect.
   */
  redirect?: RequestRedirect;
  /**
   * A string whose value is a same-origin URL, "about:client", or the empty
   * string, to set request's referrer.
   */
  referrer?: string;
  /**
   * A referrer policy to set request's referrerPolicy.
   */
  referrerPolicy?: ReferrerPolicy;
  /**
   * An AbortSignal to set request's signal.
   */
  signal?: AbortSignal | null;
}
export interface ClientOptions {
  readonly ctx?: Context;
  readonly baseURL?: URL | string;
  readonly init?: ClientInit;
  readonly jar?: CookieJar;
  readonly fetch?: (
    ctx: Context,
    request: Request,
  ) => Promise<Response>;
}
export class Client {
  public readonly opts: ClientOptions | undefined;
  constructor();
  constructor(opts: ClientOptions);
  constructor(baseURL: string);
  constructor(arg?: ClientOptions | string) {
    if (arg !== undefined) {
      if (typeof arg === "string") {
        this.opts = {
          baseURL: arg,
        };
      } else {
        this.opts = arg;
      }
    }
  }
  context(): Context {
    return this.opts?.ctx ?? background();
  }
  url(url: string | URL): URL {
    return new URL(url, this.opts?.baseURL);
  }
  do(req: string | URL | Request, init?: RequestInit): Promise<Response>;
  do(
    ctx: Context,
    req: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  do(...args: Array<any>): Promise<Response> {
    let arg = args[0];
    let ctx: Context | undefined;
    let url: URL;
    let init: RequestInit | undefined;
    if (typeof arg === "string" || arg instanceof URL) {
      url = new URL(arg, this.opts?.baseURL);
      init = args[1];
    } else if (arg instanceof Request) {
      url = new URL(arg.url);
      init = args[1];
    } else {
      ctx = arg as Context;
      arg = args[1];
      if (typeof arg === "string" || arg instanceof URL) {
        url = new URL(arg, this.opts?.baseURL);
        init = args[2];
      } else {
        //Request
        url = new URL(arg.url);
        init = args[2];
      }
    }
    return this._do(ctx, url, init);
  }

  private _nobody(
    method: string,
    cu: Context | LikeURL,
    us?: LikeURL | LikeURLSearchParams,
    params?: LikeURLSearchParams,
  ): Promise<Response> {
    let ctx: Context | undefined;
    let u: LikeURL;
    if (typeof cu === "string" || cu instanceof URL) {
      u = cu as LikeURL;
      params = us as LikeURLSearchParams;
    } else {
      ctx = cu;
      u = us as LikeURL;
    }
    const url = new URL(u, this.opts?.baseURL);
    if (params) {
      const s = new URLSearchParams(params);
      url.search = s.toString();
    }
    return this._do(
      ctx,
      url,
      {
        method: method,
      },
    );
  }
  get(
    url: LikeURL,
    search?: LikeURLSearchParams,
  ): Promise<Response>;
  get(
    ctx: Context,
    url: LikeURL,
    search?: LikeURLSearchParams,
  ): Promise<Response>;
  get(
    cu: Context | LikeURL,
    up?: LikeURL | LikeURLSearchParams,
    params?: LikeURLSearchParams,
  ): Promise<Response> {
    return this._nobody(Method.Get, cu, up, params);
  }
  head(url: string | URL, search?: LikeURLSearchParams): Promise<Response>;
  head(
    ctx: Context,
    url: string | URL,
    search?: LikeURLSearchParams,
  ): Promise<Response>;
  head(
    cu: Context | LikeURL,
    up?: LikeURL | LikeURLSearchParams,
    params?: LikeURLSearchParams,
  ): Promise<Response> {
    return this._nobody(Method.Head, cu, up, params);
  }
  delete(url: string | URL, search?: LikeURLSearchParams): Promise<Response>;
  delete(
    ctx: Context,
    url: string | URL,
    search?: LikeURLSearchParams,
  ): Promise<Response>;
  delete(
    cu: Context | LikeURL,
    up?: LikeURL | LikeURLSearchParams,
    params?: LikeURLSearchParams,
  ): Promise<Response> {
    return this._nobody(Method.Delete, cu, up, params);
  }
  private _body(
    method: string,
    cu: Context | LikeURL,
    ub?: LikeURL | LikeBodyInit | string,
    bc?: LikeBodyInit | string,
    c?: string,
  ) {
    let ctx: Context | undefined;
    let u: LikeURL;
    let b: LikeBodyInit | undefined;
    if (typeof cu === "string" || cu instanceof URL) {
      u = cu as LikeURL;
      b = ub as LikeBodyInit;
      c = bc as string;
    } else {
      ctx = cu;
      u = ub as LikeURL;
      b = bc;
    }

    return this._do(
      ctx,
      new URL(u, this.opts?.baseURL),
      {
        method: method,
        body: b,
      },
      c,
    );
  }
  post(
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  post(
    ctx: Context,
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  post(
    cu: Context | LikeURL,
    ub?: LikeURL | LikeBodyInit | string,
    bc?: LikeBodyInit | string,
    c?: string,
  ): Promise<Response> {
    return this._body(Method.Post, cu, ub, bc, c);
  }
  put(
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  put(
    ctx: Context,
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  put(
    cu: Context | LikeURL,
    ub?: LikeURL | LikeBodyInit | string,
    bc?: LikeBodyInit | string,
    c?: string,
  ): Promise<Response> {
    return this._body(Method.Put, cu, ub, bc, c);
  }
  patch(
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  patch(
    ctx: Context,
    url: LikeURL,
    body?: LikeBodyInit | string,
    contextType?: string,
  ): Promise<Response>;
  patch(
    cu: Context | LikeURL,
    ub?: LikeURL | LikeBodyInit | string,
    bc?: LikeBodyInit | string,
    c?: string,
  ): Promise<Response> {
    return this._body(Method.Patch, cu, ub, bc, c);
  }

  private _context(ctx0: Context | undefined): CancelContext {
    const parent = this.opts?.ctx;
    if (!ctx0) {
      ctx0 = parent ?? background();
      return ctx0.withCancel();
    } else if (!parent) {
      return ctx0.withCancel();
    }
    const ctx = background().withCancel();
    (async () => {
      const caseCtx = ctx.done.readCase();
      const caseParent = parent.done.readCase();
      const case0 = ctx0.done.readCase();
      switch (await selectChan(caseCtx, caseParent, case0)) {
        case case0:
          ctx.cancel(ctx0.err);
          return;
        case caseParent:
          ctx.cancel(parent.err);
          return;
          // case caseCtx: return;
      }
    })();
    return ctx;
  }
  private async _do(
    ctx0: Context | undefined,
    url: URL,
    init?: RequestInit,
    mime?: string,
  ): Promise<Response> {
    const signal = init?.signal ?? this.opts?.init?.signal;

    if (signal && signal.aborted) {
      throw signal.reason;
    } else if (ctx0?.isClosed) {
      throw ctx0.err;
    }

    const ctx = this._context(ctx0);
    let signalChan = Chan.never as Chan<any>;
    let l: any;
    if (signal) {
      signalChan = new Chan<any>();
      l = () => {
        signalChan.close();
      };
      signal.addEventListener("abort", l);
    }
    try {
      const signalCase = signalChan.readCase();
      const ctl = new AbortController();
      const doneCase = ctx.done.readCase();
      const c = new Chan<any>(1);
      const respCase = c.readCase();

      this._fetch(ctx, c, url, this._make(url, init, ctl.signal, mime));

      switch (
        await selectChan(signalCase, doneCase, respCase)
      ) {
        case signalCase:
          ctl.abort(signal!.reason);
          break;
        case doneCase:
          ctl.abort(ctx.err);
          break;
        case respCase: {
          const val = respCase.read().value;
          if (val instanceof Response) {
            return val;
          }
          throw val;
        }
        default:
          // never
          throw new Error("unexpected chan default");
      }
      return await this._wait(c);
    } finally {
      signal?.removeEventListener("abort", l);
      ctx.cancel();
    }
  }
  private async _wait(c: Chan<any>) {
    const val = (await c.read()).value;
    if (val instanceof Response) {
      return val;
    }
    throw val;
  }
  private _make(
    url: URL,
    init: RequestInit | undefined,
    signal: AbortSignal,
    mime?: string,
  ): Request {
    const def = this.opts?.init;
    let h: undefined | Headers;
    if (init?.headers === undefined) {
      if (def?.headers !== undefined) {
        h = new Headers(def.headers);
      }
    } else {
      h = new Headers(init.headers);
      if (def?.headers !== undefined) {
        const s = new Headers(def.headers);
        for (const [k, v] of s) {
          if (!h.has(k)) {
            h.set(k, v);
          }
        }
      }
    }
    const req = new Request(url, {
      body: init?.body,
      cache: init?.cache ?? def?.cache,
      credentials: init?.credentials ?? def?.credentials,
      headers: h,
      integrity: init?.integrity ?? def?.integrity,
      keepalive: init?.keepalive ?? def?.keepalive,
      method: init?.method ?? def?.method,
      mode: init?.mode ?? def?.mode,
      redirect: init?.redirect ?? def?.redirect,
      referrer: init?.referrer ?? def?.referrer,
      referrerPolicy: init?.referrerPolicy ?? def?.referrerPolicy,
      signal: signal,
    });
    if (
      req.body && (
        req.method == Method.Post || req.method == Method.Put ||
        req.method == Method.Patch
      )
    ) {
      if (req.headers.get("context-type") === null) {
        req.headers.set("context-type", mime ?? MimeForm);
      }
    }
    return req;
  }
  private async _fetch(ctx: Context, c: Chan<any>, url: URL, req: Request) {
    try {
      const opts = this.opts;
      const jar = opts?.jar;

      if (jar) {
        // add cookie to request
        const cookies = await jar.cookies(ctx, url);
        if (cookies) {
          addCookies(req.headers, ...cookies);
        }
      }
      const f = opts?.fetch;
      const resp = await (f ? f(ctx, req) : fetch(req));

      if (jar) {
        // update set-cookies to jar
        const cookies = readSetCookies(resp.headers);
        if (cookies && cookies.length > 0) {
          await jar.setCookies(ctx, url, ...cookies);
        }
      }
      c.write(resp);
    } catch (e) {
      c.write(e);
    }
  }
}
