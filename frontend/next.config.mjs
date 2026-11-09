/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_API_URL) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: INTERNAL_API_URL environment variable is mandatory in production to proxy /api requests to the Railway backend!'
      );
    }
    let internalBackend = process.env.INTERNAL_API_URL || 'http://localhost:5000/api';
    if (!internalBackend.endsWith('/api')) {
      internalBackend = `${internalBackend.replace(/\/$/, '')}/api`;
    }
    return [
      {
        source: '/api/:path*',
        destination: `${internalBackend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
