interface Dependency {
  name: string;
  url: string;
  mod: Array<string>;
}

function define(name: string, url: string, mod: Array<string>): Dependency {
  return {
    name: name,
    url: url,
    mod: mod,
  };
}
async function deps(output: string, ...deps: Array<Dependency>) {
  if (output == "") {
    output = "./";
  } else if (Deno.build.os == "windows") {
    if (!output.endsWith("\\") && !output.endsWith("/")) {
      output += "\\";
    }
  } else if (!output.endsWith("/")) {
    output += "/";
  }

  for (const dep of deps) {
    console.log(`dependency: ${dep.name} from ${dep.url}`);
    const dir = `${output}${dep.name}`;
    await Deno.mkdir(dir, { recursive: true });
    for (const mode of dep.mod) {
      console.log(` - ${mode}`);
      const found = mode.lastIndexOf("/");
      if (found) {
        await Deno.mkdir(`${dir}/${mode.substring(0, found)}`, {
          recursive: true,
        });
      }
      await Deno.writeTextFile(
        `${dir}/${mode}`,
        `export * from "${dep.url}/${mode}";`,
      );
    }
  }
}

deps(
  "deno/deps",
  define("std", "https://deno.land/std@0.167.0", [
    "testing/asserts.ts",
  ]),
  define(
    "easyts",
    "https://deno.land/x/easyts@0.1.0",
    [
      "channel.ts",
      "defer.ts",
      "exception.ts",
      "context/context.ts",
      "net/ip.ts",
      "log/mod.ts",
      "sync/once.ts",
      "io/io.ts",
      "path/path.ts",
    ],
  ),
  define(
    "luxon",
    "https://cdn.jsdelivr.net/npm/luxon@3.1.0/build/es6",
    [
      "luxon.js",
    ],
  ),
);
