import { Client, LocalFile } from "./deno/client.ts";
import { createMiddleware, logger } from "./deno/middleware.ts";

const tests = [
  {
    path: "./bin/a.mp4",
    url: "http://127.0.0.1/tools/a.mp4",
  },
  // {
  //   path: "./bin/b.mp4",
  //   url: "http://127.0.0.1/tools/Mass%20Effect%202%20Launch%20Trailer.mp4",
  // },
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
