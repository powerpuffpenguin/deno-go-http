import { Client } from "../deno/client.ts";
import { cookieString, readSetCookies } from "../deno/cookie.ts";
import { background } from "../deno/deps/easyts/context/context.ts";

import { createJar, Jar } from "../deno/jar.ts";
import { createDelay, createMiddleware, logger } from "../deno/middleware.ts";
import { MimeJSON } from "../deno/mime.ts";
import { InternalServerError } from "../deno/status.ts";
import { runServer } from "./server.ts";
const Port = 9000;
const baseURL = `http://localhost:${Port}/api/v1/`;

async function basic(baseURL: string) {
  const client = new Client({
    baseURL: baseURL,
    jar: new Jar(), // cookie jar
  });

  console.log("--------- get ---------");

  let resp = await client.get(`echo?id=2&val=3`, undefined, {
    id: "1",
    name: "kate",
  });
  let body = await resp.text();
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
  resp = await client.post(
    `echo`,
    {
      body: JSON.stringify({
        id: "1",
        name: "kate",
      }),
    },
    MimeJSON,
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
async function middleware(baseURL: string) {
  const client = new Client({
    baseURL: baseURL,
    // Set middleware to client interceptor
    fetch: createMiddleware(
      // Set the middleware, the middleware will execute the installation and setting order in sequence
      logger,
      createDelay(500),
      createJar(new Jar()), // cookie jar in middleware
      // retry on 500 InternalServerError
      async (ctx, req, next) => {
        const resp = await next(ctx, req.clone());
        if (resp.status === InternalServerError) {
          console.log(`status ${resp.status}, retry after 100ms`);
          await ctx.sleep(100);
          if (ctx.isClosed) {
            throw ctx.err;
          }
          // retry
          const r = req.clone();
          r.headers.delete("deverr");
          return next(ctx, r);
        }
        return resp;
      },
    ),
  });
  await client.get("no-page");

  await client.do("echo", {
    headers: {
      deverr: "1",
    },
  });

  const ctx = background().withTimeout(1000);
  try {
    await client.get(ctx, "http://192.168.0.222");
  } catch (e) {
    console.log(
      `timeout=${e?.timeout}`,
      `temporary=${e?.temporary}`,
      e?.message,
    );
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
