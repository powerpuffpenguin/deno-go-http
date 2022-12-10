import { Context } from "../../deps/easyts/context/context.ts";
import { DateTime } from "../../deps/luxon/luxon.js";
import { log } from "../../log.ts";
import { Method } from "../../method.ts";
import {
  NotModified,
  OK,
  PartialContent,
  RequestedRangeNotSatisfiable,
} from "../../status.ts";
import { DownloadRecord, Metadata, Target } from "../../download.ts";
import { FetchInit } from "../fetch.ts";
export interface Client {
  fetch(
    req: string | URL,
    init?: FetchInit,
  ): Promise<Response>;
}

class SafeRecord implements DownloadRecord {
  constructor(public native: DownloadRecord) {}
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
  toTarget(): Promise<void> {
    return this.native.toTarget();
  }
  append(r: ReadableStream<Uint8Array>) {
    return this.native.append(r);
  }
  async delete(): Promise<void> {
    this.closed_ = true;
    try {
      await this.native.delete();
    } catch (e) {
      log.warn(`record.delete error:`, e);
    }
    return;
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
  context?: Context;
  client: Client;
  url: URL;
  target: Target;
}
export class Downloader {
  constructor(public readonly opts: DownloaderOptions) {
  }
  async serve(): Promise<void> {
    await this._serve();
    this.opts.target.complete();
  }
  async _serve(): Promise<void> {
    const opts = this.opts;
    const target = opts.target;
    log.debug(`download ${opts.url} -> ${target}`);
    const mtime = await target.mtime();
    const r = await target.record();
    const record = r ? new SafeRecord(r) : undefined;
    try {
      if (mtime === undefined) { // target alreay exists
        if (record) { // temporary file exists
          const md = await record.metadate();
          if (md.mtime) {
            log.debug(`recover download to ${target}`);
            await this._recover(record, md);
            return;
          }
        }
        log.debug(`first download to ${target}`);
        return this._new();
      }

      if (record === undefined) { // There is no temporary file to check whether the server has an update
        const m = DateTime.fromJSDate(mtime).toHTTP();
        log.debug(`refash '${m}' ${target}`);
        return this._refash(m);
      }
      const md = await record.metadate();
      if (md.mtime) {
        log.debug(`recover download to ${target}`);
        await this._recover(record, md);
        return;
      }

      // delete invalid records
      await record.delete();
      // check server update
      const m = DateTime.fromJSDate(mtime).toHTTP();
      log.debug(`refash '${m}' ${target}`);
      return this._refash(m);
    } finally {
      await record?.close();
    }
  }
  private async _new(resp?: Response) {
    const opts = this.opts;
    if (!resp) {
      resp = await this.do(opts.url, {
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
    const resp = await this.do(opts.url, {
      method: Method.Get,
      headers: {
        "If-Modified-Since": mt,
      },
    });

    switch (resp.status) {
      case NotModified:
        log.debug(`not modified ${opts.url} -> ${opts.target}`);
        return;
      case OK:
        log.debug(`re-download ${opts.url} -> ${opts.target}`);
        return this._new();
    }
    const text = await readText(resp);
    log.warn(`new ${opts.url} error: ${text}`);
    throw new Error(text);
  }
  private async _recover(record: DownloadRecord, md: Metadata) {
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
        const m = DateTime.fromJSDate(md.mtime!).toHTTP();
        log.debug(
          `recover refash '${m}': ${opts.target}`,
        );
        return this.recoverRefash(record, m);
      }
    }
    const m = DateTime.fromJSDate(md.mtime!).toHTTP();
    log.debug(
      `recover range(${begin},${md.len}) '${m}': ${opts.target}`,
    );
    const resp = await this.do(opts.url, {
      method: Method.Get,
      headers: {
        "If-Range": m,
        "Range": `bytes=${begin}-`,
      },
    });
    switch (resp.status) {
      case OK:
        log.debug(`re-download ${opts.url} -> ${opts.target}`);
        await record.close();
        return this._new(resp);
      case RequestedRangeNotSatisfiable:
        log.warn(
          `recover 416 Range(bytes=${begin}-) Not Satisfiable ${opts.url} ${opts.target} `,
        );
        return this._new();
      case PartialContent:
        log.debug(`recover 206 Partial Content ${opts.url} ${opts.target}`);
        return record.append(resp.body!);
    }
    const text = await readText(resp);
    log.warn(`new ${opts.url} error: ${text}`);
    throw new Error(text);
  }
  private async recoverRefash(record: DownloadRecord, mt: string) {
    const opts = this.opts;
    const resp = await this.do(opts.url, {
      method: Method.Get,
      headers: {
        "If-Modified-Since": mt,
      },
    });
    switch (resp.status) {
      case NotModified:
        log.debug(`not modified ${opts.url} -> ${opts.target}`);
        return record.toTarget();
      case OK:
        log.debug(`re-download ${opts.url} -> ${opts.target}`);
        await record.close();
        return this._new(resp);
    }
    const text = await readText(resp);
    log.warn(`new ${opts.url} error: ${text}`);
    throw new Error(text);
  }
  private do(req: string | URL, init: FetchInit) {
    const opts = this.opts;
    init.context = opts.context;
    const client = opts.client;
    return client.fetch(req, init);
  }
}
