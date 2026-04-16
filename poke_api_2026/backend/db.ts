import { Database } from "sqlite3";

export const db = new Database("pokemon.db");

db.run(`
CREATE TABLE IF NOT EXISTS pokemon (
  id INTEGER PRIMARY KEY,
  name TEXT,
  sprite TEXT,
  region TEXT
)
`);