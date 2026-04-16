import { db } from "./db";

export async function getPokemon(idOrName: string) {
  const isNumber = !isNaN(Number(idOrName));

  const query = isNumber
    ? "SELECT * FROM pokemon_cache WHERE id = ?"
    : "SELECT * FROM pokemon_cache WHERE name = ?";

  const cached = await db.get(query, [idOrName]);

  if (cached) {
    return { ...cached, source: "cache" };
  }

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
  const data = await res.json();

  const speciesRes = await fetch(data.species.url);
  const species = await speciesRes.json();

  const region = species.generation.name;

  const pokemon = {
    id: data.id,
    name: data.name,
    sprite: data.sprites.front_default,
    region
  };

  await db.run(
    `INSERT INTO pokemon_cache (id, name, sprite, region, raw)
     VALUES (?, ?, ?, ?, ?)`,
    [pokemon.id, pokemon.name, pokemon.sprite, pokemon.region, JSON.stringify(data)]
  );

  return { ...pokemon, source: "api" };
}