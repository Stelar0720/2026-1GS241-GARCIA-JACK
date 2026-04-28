import { useState, useEffect } from "react";
import { api } from "../services/api";
import JoinPoll from "../components/JoinPoll";
import VoteForm from "../components/VoteForm";
import PollResults from "../components/PollResults";

export default function Student() {
  const [poll, setPoll] = useState(null);
  const [name, setName] = useState("");
  const [voted, setVoted] = useState(false);

  const join = async (code, username) => {
    const data = await api.getPollByCode(code);
    setPoll(data);
    setName(username);
  };

  const vote = async (optionIndex) => {
    const res = await api.vote(poll._id, {
      optionIndex,
      voterName: name,
    });

    if (!res.error) setVoted(true);
    else alert(res.error);
  };

  useEffect(() => {
    if (!poll || !voted) return;

    const interval = setInterval(async () => {
      const data = await api.getResults(poll._id);
      setPoll(data);
    }, 5000);

    return () => clearInterval(interval);
  }, [poll, voted]);

  if (!poll) return <JoinPoll onJoin={join} />;

  if (!voted) return <VoteForm poll={poll} onVote={vote} />;

  return <PollResults poll={poll} />;
}