import { useState } from "react";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [pokemon, setPokemon] = useState(null);

  const fetchPokemon = async () => {
    const res = await fetch(`http://localhost:3000?q=${query}`);
    const data = await res.json();
    setPokemon(data);
  };

  return (
    <div className="container">
      
      {/* Aquí luego metemos tu imagen */}
      <h1>POKE API</h1>

      <input
        placeholder="Nombre o ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button onClick={fetchPokemon}>Buscar</button>

      {pokemon && (
        <div className="card">
          <img src={pokemon.sprite} alt={pokemon.name} />
          <h2>{pokemon.name} #{pokemon.id}</h2>
          <p>Región: {pokemon.region}</p>

          <label>
            Fuente: {pokemon.source === "api" ? "API" : "CACHE"}
          </label>
        </div>
      )}
    </div>
  );
}

export default App;