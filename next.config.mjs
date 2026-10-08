/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // lib/villages.ts reads this CSV at runtime; make sure Vercel ships it with these routes.
  outputFileTracingIncludes: {
    '/api/villages': ['./data/villages_baramati.csv'],
    '/api/synthetic/*': ['./data/villages_baramati.csv'],
  },
  // In development the Python optimizer runs separately under uvicorn (see `npm run dev`).
  // On Vercel, /api/optimize is served by api/optimize.py in the same deployment.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return []
    return [
      { source: '/api/optimize', destination: 'http://127.0.0.1:8000/api/optimize' },
      { source: '/api/optimize/:path*', destination: 'http://127.0.0.1:8000/api/optimize/:path*' },
    ]
  },
}

export default nextConfig
