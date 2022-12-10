import { Client, LocalFile } from "./deno/client.ts";
import { createMiddleware, logger } from "./deno/middleware.ts";

const tests = [
  //   {
  //     path: "./bin/a.mp4",
  //     url: "http://127.0.0.1/tools/a.mp4",
  //   },
  {
    path: "./bin/b.tar.gz",
    url: "http://webpc.cdnewstar.cn/shared/kb2022/webpc_linux_amd64.tar.gz",
  },
];
const c = new Client({
  fetch: createMiddleware(
    logger,
  ),
});
for (const tt of tests) {
  await c.download({
    url: tt.url,
    target: new LocalFile(tt.path),
  });
}
