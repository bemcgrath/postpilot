import path from "path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      // ~config still resolves the one module that deliberately stayed
      // extension-side (license.ts) -- voice-storage.ts, hook-storage.ts,
      // and learning/storage.ts all promoted to @postpilot/core (2026-08-29),
      // so ~scoring and ~learning have no files left under them and were
      // removed here; both directories are gone from src/ too.
      "~config": path.resolve(__dirname, "src/config"),
      "~components": path.resolve(__dirname, "src/components"),
      "~dom": path.resolve(__dirname, "src/dom"),
      "~rewrite": path.resolve(__dirname, "src/rewrite"),
      "~": path.resolve(__dirname, "src")
    }
  }
})
