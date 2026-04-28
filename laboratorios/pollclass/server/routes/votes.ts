import { Hono } from "hono";
import { Vote } from "../models/Vote";
import { Poll } from "../models/Poll";

const votes = new Hono();

// Votar
votes.post("/:id/vote", async (c) => {
  const pollId = c.req.param("id");
  const { optionIndex, voterName } = await c.req.json();

  // Validar encuesta
  const poll = await Poll.findById(pollId);
  if (!poll) return c.json({ error: "Encuesta no existe" }, 404);

  if (poll.status === "closed") {
    return c.json({ error: "Encuesta cerrada" }, 400);
  }

  // Validar voto único
  const existingVote = await Vote.findOne({ pollId, voterName });
  if (existingVote) {
    return c.json({ error: "Ya votaste" }, 409);
  }

  // Guardar voto
  await Vote.create({ pollId, optionIndex, voterName });

  // Incrementar contador
  poll.options[optionIndex].votes += 1;
  await poll.save();

  return c.json({ message: "Voto registrado" });
});

export default votes;