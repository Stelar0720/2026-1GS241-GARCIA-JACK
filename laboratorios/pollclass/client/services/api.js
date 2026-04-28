const API_URL = "http://localhost:3001/api";

export const api = {
  // Polls
  getPolls: () => fetch(`${API_URL}/polls`).then(res => res.json()),

  createPoll: (data) =>
    fetch(`${API_URL}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(res => res.json()),

  getPollById: (id) =>
    fetch(`${API_URL}/polls/${id}`).then(res => res.json()),

  getPollByCode: (code) =>
    fetch(`${API_URL}/polls/code/${code}`).then(res => res.json()),

  closePoll: (id) =>
    fetch(`${API_URL}/polls/${id}/close`, { method: "PATCH" }),

  deletePoll: (id) =>
    fetch(`${API_URL}/polls/${id}`, { method: "DELETE" }),

  getResults: (id) =>
    fetch(`${API_URL}/polls/${id}/results`).then(res => res.json()),

  vote: (id, data) =>
    fetch(`${API_URL}/polls/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(res => res.json()),
};