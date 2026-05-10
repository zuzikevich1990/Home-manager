import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
];

const dist = "dist";

await mkdir(dist, { recursive: true });

await Promise.all(files.map((file) => copyFile(file, join(dist, file))));

await writeFile(
  join(dist, "config.js"),
  `export const APP_CONFIG = ${JSON.stringify(
    {
      secureApi: true,
    },
    null,
    2,
  )};\n`,
);
