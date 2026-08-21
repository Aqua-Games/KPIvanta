import type { NextConfig } from "next";

/**
 * Two builds from one codebase.
 *
 * Default: a Next.js server with API routes writing to the local `data/` folder.
 * With STATIC_EXPORT=1: a plain static site for GitHub Pages, where the API
 * routes are dropped and the workspace lives in the browser instead.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // The GA4 connector is optional. Keeping its dependency out of the bundle
  // means a checkout that has not installed it still builds and runs — the
  // sync route reports that setup is needed instead of the build failing.
  serverExternalPackages: ["google-auth-library"],

  ...(isStatic
    ? {
        output: "export" as const,
        basePath,
        // GitHub Pages serves each route as a directory with an index.html.
        trailingSlash: true,
        images: { unoptimized: true },
        env: {
          NEXT_PUBLIC_STATIC_EXPORT: "1",
          NEXT_PUBLIC_BASE_PATH: basePath,
        },
      }
    : {}),
};

export default nextConfig;
