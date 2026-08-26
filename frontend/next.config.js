/** @type {import('next').NextConfig} */

const nextConfig = {
  // Electron production build
  output: "export",
outputFileTracingRoot: __dirname,
  // Electron loads the exported site through file://
  assetPrefix: "./",

  // Static export compatibility
  trailingSlash: true,

  // Electron does not have a Next.js image optimization server
  images: {
    unoptimized: true,
  },

  reactStrictMode: false,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        module: false,
        worker_threads: false
      };
    }

    return config;
  }
};

module.exports = nextConfig;