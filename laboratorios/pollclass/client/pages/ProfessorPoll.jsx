import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import PollResults from "../components/PollResults";

export default function ProfessorPoll() {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);

  const load = async () => {
    const data = await api.getResults(id);
    setPoll(data);
  };

  useEffect(() => {
    load();

    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!poll) return <div>Cargando...</div>;

  return (
    <div className="p-4">
      <h1>{poll.title}</h1>
      <h2 className="text-2xl">Código: {poll.code}</h2>

      <PollResults poll={poll} />
    </div>
  );
}