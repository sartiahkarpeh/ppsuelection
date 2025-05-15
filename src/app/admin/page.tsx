// src/app/admin/page.tsx
'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Voter {
  id: string;
  fullName: string;
  universityId: string;
  email: string;
  verified: boolean;
}

interface VoteCount {
  totalVoters: number;
  totalVerified: number;
  totalVotes: number;
}

interface Candidate {
  id: string;
  name: string;
  party: string | null;
  position: string;
  photoUrl?: string;
}

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
  'Secretary General',
  'Assistant Secretary',
  'Treasurer',
  'Chaplain',
  'Chair',
];

export default function AdminPanelPage() {
  const router = useRouter();

  // Voter & Stats
  const [voters, setVoters] = useState<Voter[]>([]);
  const [stats, setStats] = useState<VoteCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  // Candidates
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [cLoading, setCLoading] = useState(true);
  const [cError, setCError] = useState<string | null>(null);

  // Live Votes
  const [liveVotes, setLiveVotes] = useState<LiveVote[]>([]);
  const [lvLoading, setLvLoading] = useState(true);
  const [lvError, setLvError] = useState<string | null>(null);

  // Load voters & stats
  const loadData = async () => {
    try {
      setError(null);
      const [vRes, sRes] = await Promise.all([
        fetch('/api/admin/voters', { credentials: 'include' }),
        fetch('/api/admin/stats',  { credentials: 'include' }),
      ]);
      if (!vRes.ok || !sRes.ok) throw new Error('Failed to fetch admin data');
      const [vData, sData] = await Promise.all([vRes.json(), sRes.json()]);
      setVoters(vData);
      setStats(sData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load candidates
  const loadCandidates = async () => {
    setCError(null);
    setCLoading(true);
    try {
      const res = await fetch('/api/admin/candidates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load candidates');
      setCandidates(await res.json());
    } catch (e: any) {
      setCError(e.message);
    } finally {
      setCLoading(false);
    }
  };

  // Load live votes
  const loadLiveVotes = async () => {
    setLvError(null);
    setLvLoading(true);
    try {
      const res = await fetch('/api/vote/live');
      if (!res.ok) throw new Error('Failed to load live votes');
      setLiveVotes(await res.json());
    } catch (e: any) {
      setLvError(e.message);
    } finally {
      setLvLoading(false);
    }
  };

  // Handlers
  const handleAddVoter = () => router.push('/register');
  const handleAddCandidate = async () => {
    const name = prompt('Candidate Name:');
    if (!name) return;
    const partyInput = prompt('Party (leave blank for independent):', '');
    if (partyInput === null) return;
    const party = partyInput.trim() || null;
    const position = prompt('Position:');
    if (!position) return;
    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, party, position }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to add candidate');
      }
      loadCandidates();
    } catch (e: any) {
      alert(e.message);
    }
  };
  const handleDeleteVoter = async (id: string, name: string) => {
    if (!confirm(Delete voter "${name}"?)) return;
    await fetch(/api/admin/voters/${id}, { method: 'DELETE', credentials: 'include' });
    loadData();
  };
  const handleDeleteCandidate = async (id: string, name: string) => {
    if (!confirm(Delete candidate "${name}"?)) return;
    await fetch(/api/admin/candidates/${id}, { method: 'DELETE', credentials: 'include' });
    loadCandidates();
  };
  const handleEditCandidate = async (
    id: string,
    currentName: string,
    currentParty: string | null,
    currentPosition: string
  ) => {
    const name = prompt('Candidate Name:', currentName);
    if (name === null) return;
    const partyInput = prompt('Party (leave blank):', currentParty ?? '');
    if (partyInput === null) return;
    const party = partyInput.trim() || null;
    const position = prompt('Position:', currentPosition);
    if (position === null) return;
    try {
      const res = await fetch(/api/admin/candidates/${id}, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, party, position }),
      });
      if (!res.ok) {
        let msg = 'Failed to update candidate';
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          msg = json.error || msg;
        } else {
          msg = await res.text() || msg;
        }
        alert(msg);
      } else {
        loadCandidates();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };
  const onPhotoChange = (id: string) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await fetch(/api/admin/candidates/${id}, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoUrl: reader.result }),
      });
      loadCandidates();
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateCards = async () => {
    const res = await fetch('/api/admin/generate-cards', { method: 'POST', credentials: 'include' });
    if (res.ok) alert('Voting cards emailed');
    else alert('Failed to generate cards');
  };
  const handleExportResults = () => window.location.href = '/api/admin/export-results';
  const handleExportVoters = () => window.location.href = '/api/admin/export-voters';

  // Initial load
  useEffect(() => {
    loadData();
    loadCandidates();
    loadLiveVotes();
    const iv = setInterval(loadLiveVotes, 30000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <p className="text-center mt-12">Loading admin data…</p>;
  if (error)   return <p className="text-center mt-12 text-red-500">{error}</p>;

  // sort manage-candidates
  const sortedCandidates = [...candidates].sort((a, b) => {
    const ia = POSITION_PRIORITY.indexOf(a.position);
    const ib = POSITION_PRIORITY.indexOf(b.position);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // group live votes
  const positionTitles = Array.from(new Set(liveVotes.map(v => v.position.title)));
  const orderedLiveTitles = [
    ...positionTitles
      .filter(t => POSITION_PRIORITY.includes(t))
      .sort((a, b) => POSITION_PRIORITY.indexOf(a) - POSITION_PRIORITY.indexOf(b)),
    ...positionTitles.filter(t => !POSITION_PRIORITY.includes(t)),
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-12">
      {/* HEADER ACTIONS */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-800">Admin Dashboard P P Savani African Students Election</h1>
        <div className="space-x-2">
          <button onClick={handleAddVoter} className="py-2 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Add Voter</button>
          <button onClick={handleAddCandidate} className="py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Add Candidate</button>
          <button onClick={handleExportVoters} className="py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Export Voter List (PDF)</button>
          <button onClick={handleGenerateCards} className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700">Generate Voting Cards</button>
          <button onClick={handleExportResults} className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Export Results (PDF)</button>
        </div>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <p className="text-sm">Registered Voters</p>
          <p className="text-2xl font-semibold">{stats?.totalVoters}</p>
        </div>
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <p className="text-sm">Verified Voters</p>
          <p className="text-2xl font-semibold">{stats?.totalVerified}</p>
        </div>
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <p className="text-sm">Votes Cast</p>
          <p className="text-2xl font-semibold">{stats?.totalVotes}</p>
        </div>
      </section>

      <p className="text-sm text-gray-600 mb-4 text-right">Ends in: {countdown}</p>

      {/* REGISTERED VOTERS */}
      <div className="overflow-auto mb-12">
        <h2 className="text-xl font-semibold mb-4">Registered Voters</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">University ID</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">Verified</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {voters.map(v => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="py-2 px-4">{v.fullName}</td>
                <td className="py-2 px-4">{v.universityId}</td>
                <td className="py-2 px-4">{v.email}</td>
                <td className="py-2 px-4">{v.verified ? '✅' : '❌'}</td>
                <td className="py-2 px-4">
                  <button onClick={() => handleDeleteVoter(v.id, v.fullName)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* LIVE VOTE COUNTS */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Live Vote Counts</h2>
        {lvLoading ? (
          <p>Loading live votes…</p>
        ) : lvError ? (
          <p className="text-red-500">{lvError}</p>
        ) : (
          orderedLiveTitles.map(title => {
            const group = liveVotes.filter(v => v.position.title === title);
            return (
              <div key={title} className="mb-8">
                <h3 className="text-xl font-bold mb-2">{title}</h3>
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
                            <img src={c.photoUrl} alt={c.name} className="h-16 w-16 object-cover rounded-full" />
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
      </section>

      {/* CANDIDATE MANAGEMENT */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Manage Candidates</h2>
        {cLoading ? (
          <p>Loading candidates…</p>
        ) : cError ? (
          <p className="text-red-500">{cError}</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b">Name</th>
                <th className="py-2 px-4 border-b">Party</th>
                <th className="py-2 px-4 border-b">Position</th>
                <th className="py-2 px-4 border-b">Photo</th>
                <th className="py-2 px-4 border-b">Upload New Photo</th>
                <th className="py-2 px-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4">{c.name}</td>
                  <td className="py-2 px-4">{c.party ?? 'Independent'}</td>
                  <td className="py-2 px-4">{c.position}</td>
                  <td className="py-2 px-4">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="h-16 w-16 object-cover rounded-full" />
                    ) : (
                      <span className="text-gray-500">No photo</span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <input type="file" accept="image/*" onChange={onPhotoChange(c.id)} className="block" />
                  </td>
                  <td className="py-2 px-4 space-x-2">
                    <button onClick={() => handleEditCandidate(c.id, c.name, c.party, c.position)} className="text-sm text-blue-600 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteCandidate(c.id, c.name)} className="text-sm text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
} 
