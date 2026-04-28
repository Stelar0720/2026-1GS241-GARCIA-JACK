import { Hono } from "hono";
import { Poll } from "../models/Poll";

const polls = new Hono();

// 🔑 Generar código único
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Crear encuesta
polls.post("/", async (c) => {
  const { title, options } = await c.req.json();

  let code;
  let exists = true;

  // Asegurar código único
  while (exists) {
    code = generateCode();
    const existing = await Poll.findOne({ code });
    if (!existing) exists = false;
  }

  const poll = await Poll.create({
    title,
    options: options.map((opt: string) => ({ text: opt })),
    code,
  });

  return c.json(poll);
});

// Listar encuestas
polls.get("/", async (c) => {
  const polls = await Poll.find().sort({ createdAt: -1 });
  return c.json(polls);
});

// Obtener por ID
polls.get("/:id", async (c) => {
  const poll = await Poll.findById(c.req.param("id"));
  return c.json(poll);
});

// Obtener por código (estudiante)
polls.get("/code/:code", async (c) => {
  const poll = await Poll.findOne({ code: c.req.param("code") });
  return c.json(poll);
});

// Cerrar encuesta
polls.patch("/:id/close", async (c) => {
  const poll = await Poll.findByIdAndUpdate(
    c.req.param("id"),
    { status: "closed", closedAt: new Date() },
    { new: true }
  );
  return c.json(poll);
});

// Eliminar encuesta
polls.delete("/:id", async (c) => {
  await Poll.findByIdAndDelete(c.req.param("id"));
  return c.json({ message: "Poll eliminada" });
});

// Resultados (para polling)
polls.get("/:id/results", async (c) => {
  const poll = await Poll.findById(c.req.param("id"));
  return c.json(poll);
});

export default polls;