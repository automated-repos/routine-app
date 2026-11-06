import type { NextConfig } from "next";

// على GitHub Pages الموقع بيبقى على /<اسم-الريبو> فبنحط NEXT_PUBLIC_BASE_PATH=/<اسم-الريبو>
// على Netlify سيبيه فاضي
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
