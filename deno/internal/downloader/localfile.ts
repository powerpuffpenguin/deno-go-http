import { Defer } from "../../deps/easyts/defer.ts";
import { readFull } from "../../deps/easyts/io/io.ts";
import { DownloadRecord, Metadata, Target } from "../../download.ts";

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
  static async load(
    dst: string,
    path: string,
  ): Promise<DownloadRecord | undefined> {
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
