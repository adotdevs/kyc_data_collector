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
};

export default nextConfig;
