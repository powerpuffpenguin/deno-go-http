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
  /**
   * The data has been downloaded and copied to the target location, and close
   */
  toTarget(): Promise<void>;

  /**
   * Add data and write to target file
   */
  append(r: ReadableStream<Uint8Array>): Promise<void>;
  /**
   * Delete invalid records and close
   */
  delete(): Promise<void>;
}
export interface Metadata {
  len: number;
  mtime: Date | undefined;
}
