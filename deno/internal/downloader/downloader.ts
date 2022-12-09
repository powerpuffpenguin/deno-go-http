import { Context } from "../../deps/easyts/context/context.ts";
import { DateTime } from "../../deps/luxon/luxon.js";
import { log } from "../../log.ts";
import { Method } from "../../method.ts";
import { OK } from "../../status.ts";
import { Client, Target } from "./types.ts";

async function readText(resp: Response) {
  try {
    const text = await resp.text();
    return `[${resp.status} ${resp.statusText}] ${text}`;
  } catch (e) {
    log.warn(`resp.text()`, e, "\n" + resp);
  }
  return `${resp.status} ${resp.statusText}`;
}
export interface DownloaderOptions {
  ctx: Context;
  client: Client;
  url: URL;
  target: Target;
}
export class Downloader {
  constructor(public readonly opts: DownloaderOptions) {
  }
  async serve(): Promise<void> {
    const opts = this.opts;
    const target = opts.target;
    log.debug(`download ${opts.url} -> ${target}`);
    const mtime = await target.mtime();
    const record = await target.record();
    try {
      if (mtime === undefined) {
        log.debug(`first download to ${target}`);
        return this._new();
      }
    } finally {
      if (record) {
        try {
          await record.close();
        } catch (e) {
          log.warn(`record.close error:`, e);
        }
      }
    }
  }
  async _new(resp?: Response) {
    const opts = this.opts;
    if (!resp) {
      resp = await opts.client.do(opts.ctx, opts.url, {
        method: Method.Get,
      });
    }
    if (resp.status != OK) {
      const text = await readText(resp);
      log.warn(`new ${opts.url} error: ${text}`);
      throw new Error(text);
    }
    const str = resp.headers.get("Last-Modified");
    const contextLength = resp.headers.get("content-length");
    const len = parseInt(contextLength ?? "0");
    if (!Number.isSafeInteger(len)) {
      throw new Error(`context-length not supported: ${contextLength}`);
    }
    let mtime: Date | undefined;
    if (str !== null) {
      const dt = DateTime.fromHTTP(str);
      if (dt.isValid) {
        mtime = dt.toJSDate();
      } else {
        log.warn(`can't parse http time ${str}`);
      }
    }
    // 寫入臨時檔案
    log.debug(`new file, modified=${str} len=${len} of ${opts.target}`);

    await opts.target.replace(resp.body!, len, mtime);
  }
}
