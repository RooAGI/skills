import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createApiHandler } from "./server/api.mjs";
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/skills/" : "/",
  plugins: [react(), { name: "skills-search-api", configureServer(server) { server.middlewares.use(createApiHandler()); } }]
});
