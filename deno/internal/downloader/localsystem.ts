import { Record, Target } from "./types.ts";
import { readFull } from "../../deps/easyts/io/io.ts";
import { Once } from "../../deps/easyts/sync/once.ts";

interface Metadata {
  mtime?: Date;
  len: number;
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
  const mt = md["mt"];
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
class TemporaryFile {
  constructor(
    public readonly path: string,
    public readonly mtime: Date | undefined,
    public readonly len: number,
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
    const r: Deno.FsFile = await Deno.open(this.path);
    const once = new Once();
    try {
      const md = await readMetdata(this.path, r);
      await copyToDst(dst, r, md.mtime);
      once.do(() => r.close());
      await Deno.remove(this.path);
    } finally {
      once.do(() => r.close());
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
  record(): Promise<Record | undefined> {
    const path = `${this.path}.denodwonload`;
    return LocalRecord.load(path);
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
  }
}
export class LocalRecord implements Record {
  static async load(path: string): Promise<Record | undefined> {
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
}
