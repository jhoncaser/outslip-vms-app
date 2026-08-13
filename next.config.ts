import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets coworkers on the same WiFi load the dev server via its LAN IP —
  // without this, Next.js dev mode blocks cross-origin requests to its own
  // dev resources (HMR, etc.) from any origin other than localhost. Update
  // this if the machine's LAN IP changes (e.g. after reconnecting to WiFi).
  allowedDevOrigins: ["192.168.30.247"],
};

export default nextConfig;
