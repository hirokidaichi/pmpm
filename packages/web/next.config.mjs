/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pmpm/shared"],
  experimental: {
    typedRoutes: false
  }
};

export default nextConfig;
