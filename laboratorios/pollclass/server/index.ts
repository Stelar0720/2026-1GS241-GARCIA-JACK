import { Hono } from "hono";
import { cors } from "hono/cors";
import { connectDB } from "./config/db";
import polls from "./routes/polls";
import votes from "./routes/votes";
import { errorHandler } from "./middleware/errorHandler";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", errorHandler);

// Conectar DB
connectDB();

// Rutas
app.route("/api/polls", polls);
app.route("/api/polls", votes);

// Health check
app.get("/", (c) => c.text("PollClass API running 🚀"));

// Servidor
const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};