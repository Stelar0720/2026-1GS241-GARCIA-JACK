export default function VoteForm({ poll, onVote }) {
  return (
    <div>
      {poll.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onVote(i)}
          className="block border p-2 w-full mb-2"
        >
          {opt.text}
        </button>
      ))}
    </div>
  );
}