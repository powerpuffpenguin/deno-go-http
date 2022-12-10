import { selectChan } from "../deps/easyts/channel.ts";
import { background, Context } from "../deps/easyts/context/context.ts";

export class ContextListener {
  public readonly ctx = background().withCancel();
  public readonly abort = new AbortController();
  mime?: string;
  constructor() {}

  add(...ctx: Array<Context | undefined>) {
    const c0 = this.ctx;
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
      this._wait(c1);
    }
  }

  private async _wait(c1: Context) {
    const c0 = this.ctx;
    const r = c1.done.readCase();
    if (r == await selectChan(c0.done.readCase(), r)) {
      c0.cancel(c1.err);
    }
  }

  signal(...signal: Array<null | undefined | AbortSignal>) {
    const c0 = this.ctx;
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
      this._waitSignal(s);
    }
  }
  private async _waitSignal(s: AbortSignal) {
    const c0 = this.ctx;

    const l = () => {
      c0.cancel(s.reason);
    };

    s.addEventListener("abort", l);
    await c0.done.read();
    s.removeEventListener("abort", l);
  }
}
