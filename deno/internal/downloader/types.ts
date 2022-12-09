import { Context } from "../../deps/easyts/context/context.ts";

export interface Client {
  do(
    ctx: Context,
    req: string | URL,
    init?: RequestInit,
  ): Promise<Response>;
}

/**
 * Define a target interface, the alternative interface can download the file to any system that implements the interface
 */
export interface Target {
  /**
   * Returns the modification time of the target file, should return undefined if the file does not exist.
   */
  mtime(): Promise<Date | undefined>;
  /**
   * Returns the archive download record or undefined if there is no record
   */
  record(): Promise<Record | undefined>;

  /**
   * alternative target file
   */
  replace(
    body: ReadableStream<Uint8Array>,
    len: number,
    mtime?: Date,
  ): Promise<void>;
}

/**
 * File Download History
 */
export interface Record {
  /**
   * close record
   */
  close(): Promise<void> | void;
  /**
   * back to download history
   */
  metadate(): Promise<Metadata> | Metadata;

  /**
   * The number of bytes downloaded
   */
  size(): Promise<number> | number;
}
export interface Metadata {
  len: number;
  mtime: Date | undefined;
}
