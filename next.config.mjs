/** @type {import('next').NextConfig} */
const nextConfig = {
  // preserve your existing env and build settings
  env: {
    NEXT_PUBLIC_USE_LOCAL_TASKS:
      process.env.NEXT_PUBLIC_USE_LOCAL_TASKS || "false",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // <<< Updated headers() section with corrected CSP >>>
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              // Allow your own scripts + inline/eval if needed
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com;",
              // Allow iframes for Google sign-in and Calendar discovery
              "frame-src https://accounts.google.com https://www.gstatic.com https://content.googleapis.com;"
            ].join(" "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
