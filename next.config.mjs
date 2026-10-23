/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3', '@libsql/client'],
};

export default nextConfig;
