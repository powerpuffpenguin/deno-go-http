import { Context } from "../../deps/easyts/context/context.ts";
import { DateTime } from "../../deps/luxon/luxon.js";
import { log } from "../../log.ts";
import { Method } from "../../method.ts";
import { NotModified, OK } from "../../status.ts";
import { Client, Metadata, Record, Target } from "./types.ts";

class SafeRecord implements Record {
  constructor(public native: Record) {}
  private closed_ = false;
  async close(): Promise<void> {
    if (this.closed_) {
      return;
    }
    this.closed_ = true;
    try {
      await this.native.close();
    } catch (e) {
      log.warn(`record.close error:`, e);
    }
  }
  metadate(): Promise<Metadata> | Metadata {
    return this.native.metadate();
  }
  size(): Promise<number> | number {
    return this.native.size();
  }
}
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
    const r = await target.record();
    const record = r ? new SafeRecord(r) : undefined;
    try {
      if (mtime === undefined) {
        if (record) {
          const md = await record.metadate();
          if (md.mtime) {
            log.debug(`recover download to ${target}`);
            await this._recover(record, md);
            return;
          }
        }
        log.debug(`first download to ${target}`);
        return this._new();
      } else {
        if (record === undefined) {
          const m = DateTime.fromJSDate(mtime).toHTTP();
          log.debug(`refash '${m}' ${target}`);
          return this._refash(m);
        }
      }
    } finally {
      await record?.close();
    }
  }
  private async _new(resp?: Response) {
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
  private async _refash(mt: string) {
    const opts = this.opts;
    const resp = await opts.client.do(opts.ctx, opts.url, {
      method: Method.Get,
      headers: {
        "If-Modified-Since": mt,
      },
    });

    switch (resp.status) {
      case NotModified:
        log.info(`not modified ${opts.url} -> ${opts.target}`);
        return;
      case OK:
        log.debug(`re-download abc ${opts.url} -> ${opts.target}`);
        return this._new();
    }
    const text = await readText(resp);
    log.warn(`new ${opts.url} error: ${text}`);
    throw new Error(text);
  }
  private async _recover(record: Record, md: Metadata) {
    const opts = this.opts;
    const begin = await record.size();
    if (md.len > 0) {
      if (begin > md.len) {
        log.warn(
          `the temporary data is larger than the record, ${begin} > ${md.len}. re-download ${opts.target}`,
        );
        await record.close();
        return this._new();
      } else if (begin == md.len) {
        // recoverRefash
      }
      log.debug(
        `recover range(${begin},${md.len}): ${opts.target}`,
      );
    }
  }
}