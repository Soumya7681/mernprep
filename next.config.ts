import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // static export — works on Cloudflare Pages, Netlify, GitHub Pages
  trailingSlash: true,       // /01-javascript/01-closures/ → /01-javascript/01-closures/index.html
  images: { unoptimized: true },
};

export default nextConfig;
