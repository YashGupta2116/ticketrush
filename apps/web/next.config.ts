import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // a self-contained server for the Docker image
  compress: false, // Caddy compresses in front of us
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
