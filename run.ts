import { Client } from "./deno/client.ts";

const tests = [
  {
    path: "./bin/a.mp4",
    url:
      "http://127.0.0.1/tools/HD%20%E4%B8%AD%E6%96%87%E5%AD%97%E5%B9%95%20Mass%20Effect%202_Cinematic%20Trailer%20%E8%B3%AA%E9%87%8F%E6%95%88%E6%87%892%20CG%E9%A0%90%E5%91%8A%E7%89%87.mp4",
  },
];
const c = new Client();
for (const tt of tests) {
  await c.downloadFile(tt.path, tt.url);
}
