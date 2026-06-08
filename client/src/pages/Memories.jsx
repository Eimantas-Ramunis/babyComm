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

  if (error) return <p className="status status--error">Nepavyko įkelti prisiminimų: {error}</p>;
  if (!memories) return <p className="status">Kraunami prisiminimai…</p>;

  if (memories.length === 0) {
    return (
      <div className="stack">
        <h2 className="page-title">Prisiminimų skrynelė</h2>
        <p className="status">
          Kol kas prisiminimų nėra. Tėtis čia gali įrašyti ypatingas akimirkas — pirmąjį širdies
          dūžį, juokingus užgaidus, mažas žinutes. 💛
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h2 className="page-title">Prisiminimų skrynelė</h2>
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
