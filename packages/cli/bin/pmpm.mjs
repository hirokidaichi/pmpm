#!/usr/bin/env node

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use tsx for TypeScript support in development
try {
  register("tsx/esm", pathToFileURL("./"));
} catch {
  // tsx not available, assume compiled JS
}

await import(resolve(__dirname, "../src/index.ts"));
