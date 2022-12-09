// deno-lint-ignore-file no-explicit-any
import { Logger } from "./deps/easyts/log/mod.ts";
export const defaultLogger = new Logger({
  prefix: "go-http",
});

export interface LogOptionsInit {
  debug?: Logger;
  info?: Logger;
  warn?: Logger;
}
export interface LogOptions {
  debug: Logger;
  info: Logger;
  warn: Logger;
}
export class Log {
  enable = true;
  readonly opts: LogOptions;
  constructor(opts?: LogOptionsInit) {
    const debug = opts?.debug ?? new Logger({
      prefix: "go-http-debug",
    });
    const info = opts?.info ?? new Logger({
      prefix: "go-http-info",
    });
    const warn = opts?.warn ?? new Logger({
      prefix: "go-http-warn",
    });
    this.opts = {
      debug: debug,
      info: info,
      warn: warn,
    };
  }
  debug(...vals: Array<any>) {
    if (this.enable) {
      this.opts.debug.log(...vals);
    }
  }
  info(...vals: Array<any>) {
    if (this.enable) {
      this.opts.info.log(...vals);
    }
  }
  warn(...vals: Array<any>) {
    if (this.enable) {
      this.opts.warn.log(...vals);
    }
  }
}
export const log = new Log();
