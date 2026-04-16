/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'static.coinpaprika.com' },
      { protocol: 'https', hostname: 'cryptocompare.com' },
      { protocol: 'https', hostname: 'www.cryptocompare.com' },
      { protocol: 'https', hostname: 'min-api.cryptocompare.com' },
      { protocol: 'https', hostname: 'images.cryptocompare.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

export default nextConfig
