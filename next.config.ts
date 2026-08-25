import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-libsql",
    "@prisma/adapter-pg",
    "better-sqlite3",
    "pg",
  ],
  outputFileTracingIncludes: {
    "/*": ["./prisma/seed.db", "./src/data/briefcast.seed.db"],
    "/api/**": ["./prisma/seed.db", "./src/data/briefcast.seed.db"],
    "/library": ["./prisma/seed.db", "./src/data/briefcast.seed.db"],
    "/episodes/[id]": ["./prisma/seed.db", "./src/data/briefcast.seed.db"],
    "/shows/[id]": ["./prisma/seed.db", "./src/data/briefcast.seed.db"],
  },
};

export default nextConfig;
