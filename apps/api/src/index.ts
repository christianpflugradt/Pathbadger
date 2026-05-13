import { createApp } from "./app.js";

async function start() {
  const app = createApp();
  const port = Number(process.env.API_PORT ?? 3001);

  await app.listen({
    host: "0.0.0.0",
    port,
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
