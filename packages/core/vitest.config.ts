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
      "~learning": path.resolve(__dirname, "src/learning"),
      "~storage": path.resolve(__dirname, "src/storage"),
      "~": path.resolve(__dirname, "src")
    }
  }
})
