/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'cloudinary', 'nodemailer', 'pdf-lib'],
  },
  async rewrites() {
    return [
      {
        source: '/index.html',
        destination: '/',
      },
      {
        source: '/get-started.html',
        destination: '/get-started',
      },
    ];
  },
};

export default nextConfig;

