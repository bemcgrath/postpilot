import { build } from "esbuild"
import { existsSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..", "..")

/**
 * Resolves the `~*` tsconfig path alias for esbuild, against
 * packages/core/src -- the pure scoring/learning/config code this widget
 * bundles moved there in the 2026-08-28 monorepo extraction. Everything
 * entry.ts imports lives under packages/core; nothing here needs
 * apps/extension/src.
 */
const tildeAlias = {
  name: "tilde-alias",
  setup(build) {
    build.onResolve({ filter: /^~/ }, (args) => {
      const rel = args.path.slice(1)
      const base = path.resolve(root, "packages", "core", "src", rel)
      for (const ext of ["", ".ts", ".tsx"]) {
        if (existsSync(base + ext)) return { path: base + ext }
      }
      return { path: base + ".ts" }
    })
  }
}

await build({
  entryPoints: [path.join(__dirname, "entry.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  outfile: path.join(root, "score", "postpilot-score.bundle.js"),
  plugins: [tildeAlias]
})

console.log("Built score/postpilot-score.bundle.js")
