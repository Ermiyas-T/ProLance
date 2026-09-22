import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // proxy API requests through Next so browser cookies and middleware stay same-origin
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
