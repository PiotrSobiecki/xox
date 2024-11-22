/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...config.externals, "bufferutil", "utf-8-validate"];
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/socket",
        destination: "/api/socket",
      },
    ];
  },
};

module.exports = nextConfig;
