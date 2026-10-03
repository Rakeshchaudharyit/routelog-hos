const backend = process.env.BACKEND_ORIGIN;
if (!backend)
  throw new Error("Set BACKEND_ORIGIN to the HTTPS Django origin in Vercel.");
const origin = new URL(backend);
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
) {
  throw new Error("BACKEND_ORIGIN must be a plain HTTPS origin.");
}
export const config = {
  framework: "vite",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites: [
    { source: "/api/:path*", destination: `${origin.origin}/api/:path*` },
    { source: "/media/:path*", destination: `${origin.origin}/media/:path*` },
    { source: "/login", destination: "/index.html" },
    { source: "/trip-planner", destination: "/index.html" },
    { source: "/settings/:path*", destination: "/index.html" },
    { source: "/", destination: "/index.html" },
  ],
  headers: [
    {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
  ],
};
