import { useEffect, useState } from "react";
import { api } from "../services/api";
import PollForm from "../components/PollForm";
import PollCard from "../components/PollCard";

export default function Professor() {
  const [polls, setPolls] = useState([]);

  const load = async () => {
    const data = await api.getPolls();
    setPolls(data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (data) => {
    await api.createPoll(data);
    load();
  };

  return (
    <div className="p-4">
      <PollForm onCreate={create} />

      <div className="mt-4 space-y-2">
        {polls.map((p) => (
          <PollCard
            key={p._id}
            poll={p}
            onDelete={async (id) => {
              await api.deletePoll(id);
              load();
            }}
            onClose={async (id) => {
              await api.closePoll(id);
              load();
            }}
          />
        ))}
      </div>
    </div>
  );
}