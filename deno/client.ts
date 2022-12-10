// deno-lint-ignore-file no-explicit-any
import { Context } from "./deps/easyts/context/context.ts";
import { Method } from "./method.ts";
import { addCookies, readSetCookies } from "./cookie.ts";
import { CookieJar } from "./cookiejar.ts";
import { MimeForm } from "./mime.ts";

import { Metadata, DownloadRecord,Target } from "./download.ts";
import { ContextListener } from "./internal/context.ts";
import { Chan, selectChan } from "./deps/easyts/channel.ts";
import { Downloader } from "./internal/downloader/downloader.ts";

import { readFull } from "./deps/easyts/io/io.ts";
import { Defer } from "./deps/easyts/defer.ts";

export type URLSearchParamsInit =
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
export interface DownloadOptions {
  ctx?: Context;
  url: URL | string;
  target: Target;
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

  private async _send(args: Array<any>, method?: Method) {
    const l = new ContextListener();
    try {
      const req =
        this._parse(l, undefined, args[0], args[1], args[2], method) ??
          this._parse(l, args[0], args[1], args[2], args[3], method)!;
      return await this._do(l, req);
    } finally {
      l.ctx.cancel();
    }
  }
  private _headers(
    init: HeadersInit | undefined,
    def: HeadersInit | undefined,
  ): Headers | undefined {
    let h: undefined | Headers;
    if (init === undefined) {
      if (def !== undefined) {
        h = new Headers(def);
      }
    } else {
      h = new Headers(init);
      if (def !== undefined) {
        const s = new Headers(def);
        for (const [k, v] of s) {
          if (!h.has(k)) {
            h.set(k, v);
          }
        }
      }
    }
    return h;
  }
  private _url(
    l: ContextListener,
    c1: Context | undefined,
    url: URL,
    init?: RequestInit,
    method?: Method,
  ): Request {
    const opts = this.opts;
    l.add(opts?.ctx, c1);
    l.signal(init?.signal);
    const def = opts?.init;

    const o = new Request(url, {
      body: init?.body,
      cache: init?.cache ?? def?.cache,
      credentials: init?.credentials ?? def?.credentials,
      headers: this._headers(init?.headers, def?.headers),
      integrity: init?.integrity ?? def?.integrity,
      keepalive: init?.keepalive ?? def?.keepalive,
      method: method ?? init?.method ?? def?.method,
      mode: init?.mode ?? def?.mode,
      redirect: init?.redirect ?? def?.redirect,
      referrer: init?.referrer ?? def?.referrer,
      referrerPolicy: init?.referrerPolicy ?? def?.referrerPolicy,
      signal: l.abort.signal,
    });
    return o;
  }
  private _request(
    l: ContextListener,
    c1: Context | undefined,
    req: Request,
    init?: RequestInit,
    method?: Method,
  ): Request {
    const opts = this.opts;
    l.add(opts?.ctx, c1);
    l.signal(init?.signal);
    const def = opts?.init;
    const h = req.headers.values.length == 0 ? undefined : req.headers;
    const o = new Request(req, {
      body: init?.body,
      cache: init?.cache ?? def?.cache,
      credentials: init?.credentials ?? def?.credentials,
      headers: this._headers(
        init?.headers ?? h,
        def?.headers,
      ),
      integrity: init?.integrity ?? def?.integrity,
      keepalive: init?.keepalive ?? def?.keepalive,
      method: method ?? init?.method ?? def?.method,
      mode: init?.mode ?? def?.mode,
      redirect: init?.redirect ?? def?.redirect,
      referrer: init?.referrer ?? def?.referrer,
      referrerPolicy: init?.referrerPolicy ?? def?.referrerPolicy,
      signal: l.abort.signal,
    });
    return o;
  }
  private _method(
    l: ContextListener,
    method?: Method,
    contextType?: string | URLSearchParamsInit,
  ): URLSearchParamsInit | undefined {
    switch (method) {
      case Method.Get:
      case Method.Head:
      case Method.Delete:
        return new URLSearchParams(contextType);
      case Method.Post:
      case Method.Put:
      case Method.Patch:
        l.mime = contextType as string;
        break;
    }
  }
  private _parse(
    l: ContextListener,
    ctx?: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string | URLSearchParamsInit,
    method?: Method,
  ): undefined | Request {
    if (typeof req === "string") {
      const search = this._method(l, method, contextType);
      const url = new URL(req, this.opts?.baseURL);
      if (search) {
        url.search = search.toString();
      }
      return this._url(l, ctx, url, init, method);
    } else if (req instanceof URL) {
      const search = this._method(l, method, contextType);
      const url = new URL(req);
      if (search) {
        url.search = search.toString();
      }
      return this._url(l, ctx, req, init, method);
    } else if (req instanceof Request) {
      const search = this._method(l, method, contextType);
      if (search) {
        const url = new URL(req.url);
        url.search = search.toString();
        req = new Request(url, req);
      }
      return this._request(l, ctx, req, init, method);
    }
    return;
  }

  do(req?: string | URL | Request, init?: RequestInit): Promise<Response>;
  do(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  do(...args: Array<any>) {
    return this._send(args);
  }
  get(
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  get(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  get(...args: Array<any>) {
    return this._send(args, Method.Get);
  }
  head(
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  head(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  head(...args: Array<any>) {
    return this._send(args, Method.Head);
  }
  delete(
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  delete(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    search?: URLSearchParamsInit,
  ): Promise<Response>;
  delete(...args: Array<any>) {
    return this._send(args, Method.Delete);
  }
  post(
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  post(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  post(...args: Array<any>) {
    return this._send(args, Method.Post);
  }
  put(
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  put(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  put(...args: Array<any>) {
    return this._send(args, Method.Put);
  }
  patch(
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  patch(
    ctx: Context,
    req?: string | URL | Request,
    init?: RequestInit,
    contextType?: string,
  ): Promise<Response>;
  patch(...args: Array<any>) {
    return this._send(args, Method.Patch);
  }

  private async _do(
    l: ContextListener,
    req: Request,
  ): Promise<Response> {
    if (req.body) {
      switch (req.method) {
        case Method.Post:
        case Method.Put:
        case Method.Patch:
          if (!req.headers.has("context-type")) {
            req.headers.set("context-type", l.mime ?? MimeForm);
          }
          break;
      }
    }
    const ctx = l.ctx;

    const signalChan = new Chan<any>();
    const signal = l.abort.signal;
    const listener = () => {
      signalChan.close();
    };
    signal.addEventListener("abort", listener);

    try {
      const signalCase = signalChan.readCase();
      const ctl = l.abort;
      const doneCase = ctx.done.readCase();
      const c = new Chan<Response>(1);
      const respCase = c.readCase();

      this._fetch(ctx, c, req);
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
  private async _fetch(ctx: Context, c: Chan<any>, req: Request) {
    try {
      const opts = this.opts;
      const jar = opts?.jar;
      const f = opts?.fetch;
      if (jar) {
        const url = new URL(req.url);
        // add cookie to request
        const cookies = await jar.cookies(ctx, url);
        if (cookies) {
          addCookies(req.headers, ...cookies);
        }

        const resp = await (f ? f(ctx, req) : fetch(req));

        // update set-cookies to jar
        const sets = readSetCookies(resp.headers);
        if (sets) {
          await jar.setCookies(ctx, url, ...sets);
        }

        c.write(resp);
      } else {
        const resp = await (f ? f(ctx, req) : fetch(req));
        c.write(resp);
      }
    } catch (e) {
      c.write(e);
    }
  }
  download(opts: DownloadOptions) {
    let url: URL;
    if (typeof opts.url === "string") {
      url = new URL(opts.url, this.opts?.baseURL);
    } else {
      url = opts.url;
    }
    // serve
    return new Downloader({
      client: this,
      ctx: opts.ctx,
      url: url,
      target: opts.target,
    }).serve();
  }
}

async function readMetdata(name: string, r: Deno.FsFile, output?: {
  len?: number;
}): Promise<Metadata> {
  let b = new Uint8Array(2);
  await readFull(r, b);
  const size = new DataView(b.buffer).getUint16(0);
  b = new Uint8Array(size);
  if (output?.len !== undefined) {
    output.len = size + 2;
  }
  await readFull(r, b);
  const text = new TextDecoder().decode(b);
  const md = JSON.parse(text);
  const mt = md["mtime"];
  if (!Number.isSafeInteger(mt)) {
    throw new Error(`unknow medatata of ${name}: ${text}`);
  }
  const len = md["len"];
  if (!Number.isSafeInteger(len)) {
    throw new Error(`unknow medatata of ${name}: ${text}`);
  }
  return {
    len: len,
    mtime: mt > 0 ? new Date(mt) : undefined,
  };
}
function copyToDst(dst: string, r: Deno.FsFile, mtime?: Date) {
  return Defer.async(async (d) => {
    const rc = d.defer(() => r.close());

    const path = dst + ".ok";
    const ok = await Deno.open(path, {
      write: true,
      truncate: true,
      create: true,
      mode: 0o664,
    });
    const okc = d.defer(() => ok.close());
    rc.cancel();
    await r.readable.pipeTo(ok.writable, {
      preventClose: true,
    });

    okc.cancel();
    ok.close();
    if (mtime) {
      await Deno.utime(path, 0, mtime);
    }
    await Deno.rename(path, dst);
  });
}
class TemporaryFile {
  constructor(
    public readonly path: string,
    public readonly len: number,
    public readonly mtime?: Date,
  ) {
  }
  async write(body: ReadableStream<Uint8Array>) {
    let f: Deno.FsFile | undefined;
    try {
      f = await Deno.open(this.path, {
        write: true,
        truncate: true,
        create: true,
        mode: 0o664,
      });
      const md = new TextEncoder().encode(JSON.stringify({
        len: this.len,
        mtime: this.mtime?.getTime() ?? 0,
      }));
      const size = new ArrayBuffer(2);
      new DataView(size).setUint16(0, md.length);
      await f.write(new Uint8Array(size));
      await f.write(md);

      await body.pipeTo(f.writable, {
        preventClose: true,
      });
    } finally {
      f?.close();
    }
  }
  async dst(dst: string) {
    let r: Deno.FsFile | undefined = await Deno.open(this.path);
    try {
      const md = await readMetdata(this.path, r);
      const src = r;
      r = undefined;
      await copyToDst(dst, src, md.mtime);

      await Deno.remove(this.path);
    } finally {
      r?.close();
    }
  }
}
export class LocalFile implements Target {
  constructor(public readonly path: string) {}
  /**
   * Returns the modification time of the target file, should return undefined if the file does not exist.
   */
  async mtime(): Promise<Date | undefined> {
    try {
      const stat = await Deno.stat(this.path);
      const mtime = stat.mtime;
      if (mtime) {
        return mtime;
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw e;
      }
    }
  }
  /**
   * Returns the archive download record or undefined if there is no record
   */
  record(): Promise<DownloadRecord | undefined> {
    const path = this.path;
    return LocalRecord.load(path, `${path}.denodwonload`);
  }
  toString() {
    return `localfile: "${this.path}"`;
  }
  /**
   * alternative target file
   */
  async replace(
    body: ReadableStream<Uint8Array>,
    len: number,
    mtime?: Date,
  ): Promise<void> {
    const path = this.path;
    const temp = `${path}.denodwonload`;
    const f = new TemporaryFile(temp, len, mtime);

    // write to temp
    await f.write(body);
    // write to target
    await f.dst(this.path);
  }
}
export class LocalRecord implements DownloadRecord {
  static async load(dst: string, path: string): Promise<DownloadRecord | undefined> {
    let f: Deno.FsFile | undefined;
    try {
      f = await Deno.open(path, {
        read: true,
        write: true,
      });
      const output = {
        len: 0,
      };
      const md = await readMetdata(path, f, output);
      const fs = f;
      f = undefined;
      return new LocalRecord(
        dst,
        path,
        md,
        output.len,
        fs,
      );
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        throw e;
      }
    } finally {
      f?.close();
    }
  }
  constructor(
    public readonly target: string,
    public readonly path: string,
    public md: Metadata,
    public readonly header: number,
    public readonly f: Deno.FsFile,
  ) {}
  private clsoed_ = false;
  async close(): Promise<void> {
    if (this.clsoed_) {
      return;
    }
    this.clsoed_ = true;
    await this.f.close();
  }
  metadate(): Metadata {
    return this.md;
  }
  async size(): Promise<number> {
    return (await this.f.seek(0, Deno.SeekMode.End)) - this.header;
  }
  async toTarget() {
    const r = this.f;
    await r.seek(this.header, Deno.SeekMode.Start);
    this.clsoed_ = true;
    await copyToDst(this.target, r, this.md.mtime);
    await Deno.remove(this.path);
  }
  async append(r: ReadableStream<Uint8Array>): Promise<void> {
    const f = this.f;
    await f.seek(0, Deno.SeekMode.End);
    for await (const b of r) {
      await f.write(b);
    }
    await this.toTarget();
  }
  async delete(): Promise<void> {
    await this.close();
    await Deno.remove(this.path);
  }
}
