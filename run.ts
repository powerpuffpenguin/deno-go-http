import { Client } from "./deno/client.ts";
import { Once } from "./deno/deps/easyts/sync/once.ts";

const tests = [
  {
    path: "./bin/a.mp4",
    url: "http://127.0.0.1/tools/a.mp4",
  },
];
const c = new Client();
for (const tt of tests) {
  await c.downloadFile(tt.path, tt.url);
}
