// deno-lint-ignore-file no-explicit-any
import { Context } from "./deps/easyts/context/context.ts";
import { Method } from "./method.ts";
import { addCookies, readSetCookies } from "./cookie.ts";
import { CookieJar } from "./cookiejar.ts";
import { MimeForm } from "./mime.ts";

import { Target } from "./download.ts";

import { Chan, selectChan } from "./deps/easyts/channel.ts";
import { Downloader } from "./internal/downloader/downloader.ts";

import { createFetch, Fetch, FetchInit } from "./internal/fetch.ts";
export type { FetchInit } from "./internal/fetch.ts";
export { LocalFile } from "./internal/downloader/localfile.ts";
export type {
  LocalFileEvent,
  LocalFileOptions,
} from "./internal/downloader/localfile.ts";

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
export interface DownloadOptions {
  context?: Context;
  url: URL | string;
  target: Target;
}

export class Client {
  constructor(public readonly opts?: ClientOptions) {}
  private async _send(
    input: string | URL | Request,
    init?: FetchInit,
    method?: Method,
  ): Promise<Response> {
    const fetch = createFetch(input, init, this.opts?.init, method);
    try {
      return await this._do(fetch);
    } finally {
      fetch.cancel();
    }
  }
  fetch(input: string | URL | Request, init?: FetchInit): Promise<Response> {
    return this._send(input, init);
  }
  get(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Get);
  }
  head(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Head);
  }
  delete(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Delete);
  }
  post(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Post);
  }
  put(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Put);
  }
  patch(input: string | URL | Request, init?: FetchInit) {
    return this._send(input, init, Method.Patch);
  }

  private async _do(
    f: Fetch,
  ): Promise<Response> {
    const req = f.request;
    if (req.body) {
      if (!req.headers.has("context-type")) {
        req.headers.set("context-type", f.contextType ?? MimeForm);
      }
    }
    const ctx = f.ctx;

    const signalChan = new Chan<any>();
    const abort = f.abort;
    const signal = abort.signal;
    const listener = () => {
      signalChan.close();
    };
    signal.addEventListener("abort", listener);

    try {
      const signalCase = signalChan.readCase();
      const doneCase = ctx.done.readCase();
      const c = new Chan<Response>(1);
      const respCase = c.readCase();

      this._fetch(ctx, c, f.url, req);
      switch (
        await selectChan(signalCase, doneCase, respCase)
      ) {
        case signalCase:
          abort.abort(signal!.reason);
          break;
        case doneCase:
          abort.abort(ctx.err);
          break;
        case respCase: {
          const val = respCase.read();
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
      signal?.removeEventListener("abort", listener);
    }
  }
  private async _wait(c: Chan<any>) {
    const val = await c.read();
    if (val instanceof Response) {
      return val;
    }
    throw val;
  }
  private async _fetch(ctx: Context, c: Chan<any>, url: URL, req: Request) {
    try {
      const opts = this.opts;
      const jar = opts?.jar;
      const f = opts?.fetch;
      if (jar) {
        // add cookie to request
        const cookies = await jar.cookies(ctx, url);
        if (cookies) {
          addCookies(req.headers, ...cookies);
        }

        const resp = await (f ? f(ctx, url, req) : fetch(req));

        // update set-cookies to jar
        const sets = readSetCookies(resp.headers);
        if (sets) {
          await jar.setCookies(ctx, url, ...sets);
        }

        c.write(resp);
      } else {
        const resp = await (f ? f(ctx, url, req) : fetch(req));
        c.write(resp);
      }
    } catch (e) {
      c.write(e);
    }
  }
  download(opts: DownloadOptions) {
    const url = new URL(opts.url);
    // serve
    return new Downloader({
      client: this,
      context: opts.context,
      url: url,
      target: opts.target,
    }).serve();
  }
}
