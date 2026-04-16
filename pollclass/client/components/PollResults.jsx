export default function PollResults({ poll }) {
  return (
    <div>
      {poll.options.map((opt, i) => (
        <div key={i} className="mb-2">
          <div>{opt.text}</div>
          <div className="bg-gray-300 h-4">
            <div
              className="bg-green-500 h-4"
              style={{ width: `${opt.votes * 10}%` }}
            />
          </div>
          <small>{opt.votes} votos</small>
        </div>
      ))}
    </div>
  );
}