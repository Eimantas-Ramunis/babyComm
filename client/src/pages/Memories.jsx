import { useEffect, useState } from 'react';
import { getMemories } from '../services/api.js';

export default function Memories() {
  const [memories, setMemories] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMemories()
      .then((data) => setMemories(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="status status--error">Could not load memories: {error}</p>;
  if (!memories) return <p className="status">Loading memories…</p>;

  if (memories.length === 0) {
    return (
      <div className="stack">
        <h2 className="page-title">Memory capsule</h2>
        <p className="status">
          No memories yet. Dad can add special moments here — first heartbeat, funny cravings,
          little notes. 💛
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h2 className="page-title">Memory capsule</h2>
      <ol className="timeline">
        {memories.map((m) => (
          <li key={m.id} className="timeline__item card">
            <div className="timeline__head">
              <span className="timeline__date">{m.memoryDate}</span>
            </div>
            <h3 className="timeline__title">{m.title}</h3>
            {m.body && <p className="timeline__message">{m.body}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
