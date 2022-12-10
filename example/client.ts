import { Client } from "../deno/client.ts";
import { cookieString, readSetCookies } from "../deno/cookie.ts";
import { background } from "../deno/deps/easyts/context/context.ts";

import { createJar, Jar } from "../deno/jar.ts";
import { createDelay, createMiddleware, logger } from "../deno/middleware.ts";
import { MimeJSON } from "../deno/mime.ts";
import { InternalServerError } from "../deno/status.ts";
import { runServer } from "./server.ts";
const Port = 9000;
const baseURL = new URL(`http://localhost:${Port}/api/v1/`);

async function basic(baseURL: URL) {
  const client = new Client({
    init: {
      url: baseURL,
    },
    jar: new Jar(), // cookie jar
  });

  console.log("--------- get ---------");

  let resp = await client.get(`echo?id=2&val=3`, {
    search: {
      id: "1",
      name: "kate",
    },
    body: "get",
  });
  let body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
${body}`);

  resp = await client.delete(`echo?id=2&val=3`, {
    search: {
      id: "1",
      name: "kate",
    },
    body: "delete",
  });
  body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
${body}`);

  console.log("--------- post form ---------");
  resp = await client.post(`echo?id=1`, {
    body: new URLSearchParams({
      id: "1",
      name: "kate",
    }),
  });
  body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
      ${body}`);

  console.log("--------- post json ---------");
  resp = await client.put(
    `echo`,
    {
      contextType: MimeJSON,
      body: JSON.stringify({
        id: "1",
        name: "kate",
      }),
    },
  );
  body = await resp.text();
  console.log(`${resp.status} ${resp.statusText}
    ${body}`);

  console.log("--------- cookie ---------");
  for (let i = 0; i < 5; i++) {
    resp = await client.get(`cookie`);
    const body = await resp.text();
    const cookies = readSetCookies(resp.headers)?.map((v) => cookieString(v));
    console.log(`body: ${body}
    cookies: ${cookies}
    `);
  }
}
async function middleware(baseURL: URL) {
  const client = new Client({
    init: {
      url: baseURL,
    },
    // Set middleware to client interceptor
    fetch: createMiddleware(
      // Set the middleware, the middleware will execute the installation and setting order in sequence
      logger,
      createDelay(500),
      // retry on 500 InternalServerError
      async (ctx, url, req, next) => {
        const resp = await next(ctx, url, req.body ? req.clone() : req);
        if (resp.status === InternalServerError) {
          console.log(`status ${resp.status}, retry after 100ms`);
          await ctx.sleep(100);
          if (ctx.isClosed) {
            throw ctx.err;
          }
          // retry
          const r = req.body ? req : req.clone();
          r.headers.delete("deverr"); // Remove the error flag for debugging, the test server will no longer return an error
          return next(ctx, url, r);
        }
        return resp;
      },
      /**
       * other your middleware
       * ...
       */
      // cookie jar in middleware
      createJar(new Jar()), // Set createJar to last so that retried requests can also be handled by cookiejar
    ),
  });
  await client.get("no-page");

  await client.fetch("echo", {
    headers: {
      deverr: "1",
    },
  });

  const ctx = background().withTimeout(1000);
  ctx.done.read()?.then(() => {
    console.log("done-------");
  });
  try {
    await client.get("http://192.168.0.222", {
      context: ctx,
    });
  } catch (e) {
    console.log(
      `timeout=${e?.timeout}`,
      `temporary=${e?.temporary}`,
      e?.message,
    );
  } finally {
    ctx.cancel();
  }

  console.log("--------- cookie ---------");
  for (let i = 0; i < 5; i++) {
    const resp = await client.get(`cookie`);
    const body = await resp.text();
    const cookies = readSetCookies(resp.headers)?.map((v) => cookieString(v));
    console.log(`body: ${body}
    cookies: ${cookies}
    `);
  }
}

// run a server for demo
runServer(Port);

// wait server work
await new Promise((resolve) => setTimeout(resolve, 100));

// demo basic
await basic(baseURL);

// demo middle
await middleware(baseURL);

// exit deno
Deno.exit();
