/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = withPWA({
  reactStrictMode: true,

  images: {
    domains: ['avatars.yandex.net'],
  },

  async redirects() {
    return [
      { source: '/admin/keys/buildings', destination: '/admin/buildings', permanent: false },
    ];
  },
});

module.exports = nextConfig;  