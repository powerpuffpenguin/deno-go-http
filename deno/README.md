# deno-go-http

deno's go style http library

[document](deno/README.md)

```
import { Client, Jar, MimeJSON } from "https://deno.land/x/gohttp/mod.ts";

const c = new Client({
  jar: new Jar(), // cookie jar
});

// get
let resp = await c.get("https://deno.land/x?query=gohttp");
console.log(resp.status, resp.statusText);

// post form
resp = await c.post(
  "https://deno.land",
  new URLSearchParams({
    id: "1",
    lv: "2",
  }),
);
console.log(resp.status, resp.statusText);

// post json
resp = await c.post(
  "https://deno.land",
  JSON.stringify({
    id: "1",
    lv: "2",
  }),
  MimeJSON,
);
console.log(resp.status, resp.statusText);
```
