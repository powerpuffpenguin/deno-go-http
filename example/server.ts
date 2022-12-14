import { readCookie, setCookies } from "../deno/cookie.ts";
import { InternalServerError, NotFound, OK } from "../deno/status.ts";
const router: Array<{
  pattern: URLPattern;
  handler(req: Request): Response | PromiseLike<Response>;
}> = [
  {
    pattern: new URLPattern({
      pathname: "/api/v1/echo",
    }),
    async handler(req) {
      const url = new URL(req.url);
      const val = req.headers.get("deverr");
      if (val == "1") {
        return new Response(`dev on err`, {
          status: InternalServerError,
        });
      }
      const t = req.headers.get("context-type");
      const body = await req.text();
      return new Response(`method: ${req.method}
search: ${url.search}
context-type: ${t}
body: ${body}
`);
    },
  },
  {
    pattern: new URLPattern({
      pathname: "/api/v1/cookie",
    }),
    handler(req) {
      // get cookie
      const value = readCookie(req.headers, "val")?.value;
      let val = value ? parseInt(value) : 0;
      if (Number.isSafeInteger(val) && val < Number.MAX_SAFE_INTEGER) {
        val++;
      } else {
        val = 1;
      }
      // set cookie
      const header = new Headers();
      setCookies(header, {
        name: "val",
        value: val.toString(),
      }, {
        name: "dev",
        value: "1=2",
      }, {
        name: "dev2",
        value: "2=1",
      });
      return new Response(`value: ${val}`, {
        headers: header,
      });
    },
  },
  {
    pattern: new URLPattern({
      pathname: "/",
    }),
    handler() {
      return new Response("deno-go-http demo server\n", {
        status: OK,
      });
    },
  },
];

function handler(evt: Deno.RequestEvent) {
  const url = new URL(evt.request.url);
  for (const r of router) {
    if (r.pattern.test(url)) {
      evt.respondWith(r.handler(evt.request));
      return;
    }
  }

  evt.respondWith(
    new Response(`not found page: ${url.pathname}`, {
      status: NotFound,
    }),
  );
}
export async function runServer(port: number) {
  const l = await Deno.listen({
    port: port,
  });
  console.log(`http listen on: localhost:${port}`);

  router.push({
    pattern: new URLPattern({
      pathname: "/api/v1/quit",
    }),
    handler(_) {
      l.close();
      return new Response(`quit`, {
        status: OK,
      });
    },
  });

  for await (const c of l) {
    (async (c) => {
      for await (const evt of Deno.serveHttp(c)) {
        handler(evt);
      }
    })(c);
  }
}
