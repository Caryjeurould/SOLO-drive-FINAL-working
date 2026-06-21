/**
 * Vercel-specific Vite config.
 *
 * @lovable.dev/vite-tanstack-config hardcodes the Cloudflare Workers adapter
 * internally, so deploying to Vercel requires bypassing that wrapper and
 * wiring the same plugins directly with the nitro "vercel" preset.
 *
 * Run:  bun run build:vercel
 * Then: npx vercel --prebuilt
 */

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
    nitro({
      preset: "vercel",
      vercel: { runtime: "nodejs22.x" },
      // Required for Nitro to scan server/middleware (password wall) — defaults to false.
      serverDir: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
