import path from "path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      // ~scoring/~config/~learning still resolve a small number of modules
      // that deliberately stayed extension-side in the monorepo extraction
      // (voice-storage.ts, license.ts, learning/storage.ts) -- everything
      // else moved to @postpilot/core, resolved via the workspace link in
      // node_modules, no alias needed for it.
      "~scoring": path.resolve(__dirname, "src/scoring"),
      "~config": path.resolve(__dirname, "src/config"),
      "~components": path.resolve(__dirname, "src/components"),
      "~learning": path.resolve(__dirname, "src/learning"),
      "~dom": path.resolve(__dirname, "src/dom"),
      "~": path.resolve(__dirname, "src")
    }
  }
})
