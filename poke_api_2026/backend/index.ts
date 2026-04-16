import { serve } from "bun";
import { getPokemon } from "./pokemon.service";

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const id = url.searchParams.get("q");

    if (!id) {
      return new Response("Missing query", { status: 400 });
    }

    const data = await getPokemon(id);

    return Response.json(data);
  }
});