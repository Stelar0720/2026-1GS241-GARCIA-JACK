import { useNavigate } from "react-router-dom";

export default function PollCard({ poll, onDelete, onClose }) {
  const nav = useNavigate();

  return (
    <div className="border p-4">
      <h3>{poll.title}</h3>
      <p>Código: {poll.code}</p>
      <p>Estado: {poll.status}</p>

      <button onClick={() => nav(`/professor/poll/${poll._id}`)}>
        Ver
      </button>

      <button onClick={() => onClose(poll._id)}>Cerrar</button>
      <button onClick={() => onDelete(poll._id)}>Eliminar</button>
    </div>
  );
}