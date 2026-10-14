/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server action & edge runtime compatibility
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
