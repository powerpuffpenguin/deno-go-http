import { Client } from "../deno/client.ts";
import { Jar } from "../deno/jar.ts";
import { createDelay, createMiddleware, logger } from "../deno/middleware.ts";
import { NotFound } from "../deno/status.ts";
const baseURL = "http://127.0.0.1:80";

async function basic() {
  const client = new Client({
    baseURL: baseURL,
    jar: new Jar(), // cookie jar
  });

  const resp = await client.get("");
  console.log(`${resp.status} ${resp.statusText}`);
}
async function middleware() {
  const client = new Client({
    baseURL: baseURL,
    jar: new Jar(), // cookie jar
    // Set middleware to client interceptor
    fetch: createMiddleware(
      // Set the middleware, the middleware will execute the installation and setting order in sequence
      logger,
      createDelay(500),
      // retry on 404
      async (ctx, req, next) => {
        const resp = await next(ctx, req);
        if (resp.status === NotFound) {
          console.log(`status ${resp.status}, retry after 100ms`);
          await ctx.sleep(100);
          if (ctx.isClosed) {
            throw ctx.err;
          }
          // retry
          return next(ctx, req);
        }
        return resp;
      },
    ),
  });
  await client.get("");
  await client.get("/abc");
}

await basic();
await middleware();
