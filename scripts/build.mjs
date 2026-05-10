import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
];

const dist = "dist";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

await mkdir(dist, { recursive: true });

await Promise.all(files.map((file) => copyFile(file, join(dist, file))));

await writeFile(
  join(dist, "config.js"),
  `export const APP_CONFIG = ${JSON.stringify(
    {
      supabaseUrl,
      supabaseAnonKey,
    },
    null,
    2,
  )};\n`,
);
