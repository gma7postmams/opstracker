/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Uploaded files are user content. Even though only images are
        // accepted, never let one execute or be sniffed into a document type
        // if it is opened directly (this also neutralises any SVG uploaded
        // before SVG was disallowed).
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
