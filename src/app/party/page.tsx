// src/app/party/page.tsx
'use client';
import { useState, useEffect } from 'react';

interface LiveVote {
  id: string;
  name: string;
  party: string | null;
  votes: number;
  photoUrl?: string;
  position: { id: string; title: string };
}

const POSITION_PRIORITY = [
  'President',
  'Vice President',
  'General Secretary',
  'Assistant Secretary',
  'Financial Secretary',
  'Treasurer',
  'Chaplain',
  'Chair',
];

export default function PartyDashboardPage() {
  const [liveVotes, setLiveVotes] = useState<LiveVote[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const loadLiveVotes = async () => {
    try {
      setError(null);
      const res = await fetch('/api/vote/live');
      if (!res.ok) throw new Error('Failed to load live votes');
      setLiveVotes(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveVotes();
    const iv = setInterval(loadLiveVotes, 30000);
    return () => clearInterval(iv);
  }, []);

  const positionTitles = Array.from(
    new Set(liveVotes.map(v => v.position.title))
  );
  const orderedTitles = [
    ...positionTitles
      .filter(t => POSITION_PRIORITY.includes(t))
      .sort((a, b) => POSITION_PRIORITY.indexOf(a) - POSITION_PRIORITY.indexOf(b)),
    ...positionTitles.filter(t => !POSITION_PRIORITY.includes(t))
  ];

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-12">
      <h1 className="text-3xl font-bold mb-6 text-center">Live Vote Results</h1>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        orderedTitles.map(title => {
          const group = liveVotes.filter(v => v.position.title === title);
          return (
            <div key={title} className="mb-8">
              <h2 className="text-2xl font-semibold mb-2">{title}</h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b">Photo</th>
                    <th className="py-2 px-4 border-b">Candidate</th>
                    <th className="py-2 px-4 border-b">Party</th>
                    <th className="py-2 px-4 border-b">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-2 px-4">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.name}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-gray-200 rounded-full" />
                        )}
                      </td>
                      <td className="py-2 px-4">{c.name}</td>
                      <td className="py-2 px-4">{c.party ?? 'Independent'}</td>
                      <td className="py-2 px-4">{c.votes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
