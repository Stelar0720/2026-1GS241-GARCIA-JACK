import { useState } from "react";

export default function JoinPoll({ onJoin }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="space-y-2">
      <input
        placeholder="Código"
        className="border p-2 w-full"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <input
        placeholder="Nombre"
        className="border p-2 w-full"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => onJoin(code, name)}
        className="bg-blue-500 text-white p-2 w-full"
      >
        Unirme
      </button>
    </div>
  );
}