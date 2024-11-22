/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      "supports-color": false,
    };

    config.externals.push({
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate",
    });

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/socket",
        destination: "/server",
      },
    ];
  },
};

module.exports = nextConfig;
