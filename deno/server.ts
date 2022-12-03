import { background, Context as goContext } from "../deps/easyts/context.ts";
export type Handle = (
  ctx: Context,
) => Promise<Response>;
export interface Handler {
  do(ctx: Context): Promise<Response>;
}
export type HandlerLike = Handle | Handler;
class HandleChan {
  chan: Array<HandlerLike> = [];
  constructor(
    public readonly method: string,
    public readonly pattern: URLPattern,
  ) {
  }
}
export class Router {
  protected chan: Array<HandleChan> = [];
  constructor(path: string) {
  }
  group(path: string): Router {
    throw "no impl";
  }
}
/**
 * An experimental http server
 * @beta
 */
export class Server extends Router {
  async serve(l: Deno.Listener) {
    for await (const c of l) {
      this._serve(c);
    }
  }
  private async _serve(c: Deno.Conn) {
    for await (const evt of Deno.serveHttp(c)) {
      this._handler(evt);
    }
  }
  private async _handler(evt: Deno.RequestEvent) {
    try {
      const signal = evt.request.signal;
      if (signal.aborted) {
        return;
      }
      const ctx = background().withCancel();
      const l = () => {
        ctx.cancel();
      };
      try {
        signal.addEventListener("abort", l);
        this._dispatch(new Context(ctx, evt));
      } finally {
        ctx.cancel();
        signal.removeEventListener("abort", l);
      }
    } catch (e) {
      console.warn("serveHttp error:", e);
    }
  }
  private async _dispatch(ctx: Context) {
  }
}

export class Context {
  private readonly evt_: Deno.RequestEvent;
  readonly request: Request;
  readonly url: URL;
  constructor(public readonly ctx: goContext, evt: Deno.RequestEvent) {
    this.evt_ = evt;
    const request = evt.request;
    this.request = request;
    this.url = new URL(request.url);
  }
}
