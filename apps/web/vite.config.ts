import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_API_UPSTREAM = "http://127.0.0.1:3001";
const DEFAULT_TILESERVER_UPSTREAM = "http://127.0.0.1:8080";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUpstream =
    env.PATHBADGER_API_UPSTREAM?.trim() || DEFAULT_API_UPSTREAM;
  const tileserverUpstream =
    env.PATHBADGER_TILESERVER_UPSTREAM?.trim() || DEFAULT_TILESERVER_UPSTREAM;

  return {
    envPrefix: ["VITE_", "PUBLIC_"],
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: apiUpstream,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/styles": {
          target: tileserverUpstream,
        },
        "/tiles": {
          target: tileserverUpstream,
        },
      },
    },
  };
});
