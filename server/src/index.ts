import { app } from "./app.js";
import { db } from "./db.js";
import { config } from "./config.js";
import { expireAttempts } from "./services/attempts.js";
await db.$queryRaw`PRAGMA journal_mode = WAL`;
await db.$queryRaw`PRAGMA busy_timeout = 5000`;
await expireAttempts();
let running = false;
const sweeper = setInterval(() => {
  if (running) return;
  running = true;
  expireAttempts()
    .catch((e) =>
      console.error(
        "Expiration sweep failed:",
        e instanceof Error ? e.message : "unknown",
      ),
    )
    .finally(() => {
      running = false;
    });
}, 10000);
const server = app.listen(config.PORT, () =>
  console.log(`Assessment API listening on port ${config.PORT}`),
);
function shutdown() {
  clearInterval(sweeper);
  server.close(() => {
    void db.$disconnect().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
