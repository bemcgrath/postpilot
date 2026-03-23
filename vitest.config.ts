import path from "path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "~scoring": path.resolve(__dirname, "src/scoring"),
      "~config": path.resolve(__dirname, "src/config"),
      "~components": path.resolve(__dirname, "src/components"),
      "~": path.resolve(__dirname, "src")
    }
  }
})
