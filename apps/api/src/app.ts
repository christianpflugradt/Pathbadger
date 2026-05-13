import Fastify from "fastify";

export function createApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => ({
    region: "Schleswig-Holstein",
    service: "api",
    status: "ok",
  }));

  return app;
}
