import { useState } from "react";

export default function PollForm({ onCreate }) {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => setOptions([...options, ""]);

  const updateOption = (i, value) => {
    const newOptions = [...options];
    newOptions[i] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ title, options });
    setTitle("");
    setOptions(["", ""]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        className="border p-2 w-full"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {options.map((opt, i) => (
        <input
          key={i}
          className="border p-2 w-full"
          placeholder={`Opción ${i + 1}`}
          value={opt}
          onChange={(e) => updateOption(i, e.target.value)}
        />
      ))}

      <button type="button" onClick={addOption} className="bg-gray-300 p-2">
        + Opción
      </button>

      <button className="bg-blue-500 text-white p-2 w-full">
        Crear Encuesta
      </button>
    </form>
  );
}