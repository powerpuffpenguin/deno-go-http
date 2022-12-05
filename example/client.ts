import { Client } from "../deno/client.ts";
import { getCookies, getSetCookies } from "../deno/cookie.ts";
import { Jar } from "../deno/jar.ts";
import { createDelay, createMiddleware, logger } from "../deno/middleware.ts";
import { MimeJSON } from "../deno/mime.ts";
import { NotFound } from "../deno/status.ts";
import { runServer } from "./server.ts";
const Port = 9000;
const baseURL = `http://localhost:${Port}/api/v1/`;

async function basic(baseURL: string) {
  const client = new Client({
    baseURL: baseURL,
    jar: new Jar(), // cookie jar
  });

  console.log("--------- get ---------");

  let resp = await client.get(`echo?id=2&val=3`, { // Optional Search Params, If set overrides the value in the url parameter
    id: "1",
    name: "kate",
  });
  let body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
${body}`);

  console.log("--------- post form ---------");
  const search = new URLSearchParams({
    id: "1",
    name: "kate",
  });
  resp = await client.post(`echo?id=1`, search);
  body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
${body}`);

  console.log("--------- post json ---------");
  resp = await client.post(
    `echo`,
    JSON.stringify({
      id: "1",
      name: "kate",
    }),
    MimeJSON,
  );
  body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
${body}`);

  console.log("--------- cookie ---------");
  for (let i = 0; i < 5; i++) {
    resp = await client.get(`cookie`);
    const body = await resp.text();
    const cookies = getSetCookies(resp.headers);
    console.log(`body: ${body}
cookies: ${cookies}
`);
    console.log(resp.headers);
  }
}
async function middleware(baseURL: string) {
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

// run a server for demo
runServer(Port);

// wait server work
await new Promise((resolve) => setTimeout(resolve, 100));

// demo basic
await basic(baseURL);
// // demo middle
// await middleware(baseURL);
