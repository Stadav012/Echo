import path from "node:path";
import type { NextConfig } from "next";

// Repo uses npm workspaces; deps are hoisted to the repo root.
// Point Turbopack at the repo root so node_modules resolves.
const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.255.32.100"],
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  // pdf-parse pulls in pdfjs-dist which needs to load a worker file at runtime.
  // Turbopack can't bundle that; let Node's resolver handle it server-side.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
