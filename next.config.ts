import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The GA4 connector is optional. Keeping its dependency out of the bundle
  // means a checkout that has not installed it still builds and runs — the
  // sync route reports that setup is needed instead of the build failing.
  serverExternalPackages: ["google-auth-library"],
};

export default nextConfig;
