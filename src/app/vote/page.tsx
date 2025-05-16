'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Candidate {
  id: string;
  name: string;
  photoUrl: string;
  party: string | null;
}
interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
}

export default function VotePage() {
  const router = useRouter();
  const [positions, setPositions]   = useState<Position[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [hasVoted, setHasVoted]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [countdown, setCountdown]   = useState<string>('');
  const [mounted, setMounted]       = useState(false);
  const [votingOpen, setVotingOpen] = useState(false);

  // Priority (unchanged)
  const POSITION_PRIORITY = [
  'President',
  'Vice President',
  'Secretary General',
  'Assistant Secretary',
  'Treasurer',
  'Chaplain',
  'Chair',
  ];

  // Retrieve the same key we set on login
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('voter_token')
    : null;

  const handleLogout = () => {
    localStorage.removeItem('voter_token');
    router.push('/login');
  };

  // mark as mounted
  useEffect(() => { setMounted(true); }, []);

  // Voting window timer
  useEffect(() => {
    if (!mounted) return;
    const now   = new Date();
    const start = new Date(now); start.setHours(10, 9, 0, 0);
    const end   = new Date(now); end.setHours(11, 0, 0, 0);

    function update() {
      const n = new Date();
      if (n < start) {
        setVotingOpen(false);
        const d = start.getTime() - n.getTime();
        const h = Math.floor(d / 3600000);
        const m = Math.floor((d % 3600000) / 60000);
        const s = Math.floor((d % 60000) / 1000);
        setCountdown(`Voting starts in ${h}h ${m}m ${s}s`);
      } else if (n <= end) {
        setVotingOpen(true);
        const d = end.getTime() - n.getTime();
        const h = Math.floor(d / 3600000);
        const m = Math.floor((d % 3600000) / 60000);
        const s = Math.floor((d % 60000) / 1000);
        setCountdown(`${h}h ${m}m ${s}s remaining`);
      } else {
        setVotingOpen(false);
        setCountdown('Voting has closed');
      }
    }

    update();
    const tid = setInterval(update, 1000);
    return () => clearInterval(tid);
  }, [mounted]);

  // Fetch, sort & set positions
  const loadCandidates = () => {
    setError(null);
    fetch('/api/candidates')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load candidates');
        return res.json();
      })
      .then((data: Position[]) => {
        data.sort((a, b) => {
          const ia = POSITION_PRIORITY.indexOf(a.title);
          const ib = POSITION_PRIORITY.indexOf(b.title);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        setPositions(data);
      })
      .catch(err => setError(err.message || 'Failed to load candidates.'));
  };

  // Auth guard + load
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadCandidates();
  }, [token, router]);

  // ——— one radio group per position ———
  const handleSelection = (positionId: string, candidateId: string) => {
    const updated = { ...selections, [positionId]: candidateId };
    setSelections(updated);
    sessionStorage.setItem('selections', JSON.stringify(updated));
  };

  const handleVote = async () => {
    if (!votingOpen) {
      setError('Voting is not open at this time.');
      return;
    }
    if (Object.keys(selections).length === 0) {
      setError('Please select at least one candidate.');
      return;
    }
    if (!confirm("Confirm your selections?")) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vote failed');
      setHasVoted(true);
      sessionStorage.removeItem('selections');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Avoid SSR mismatch
  if (!token && typeof window !== 'undefined') return null;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-lg mt-12">
      <nav className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-800 text-align-center">
          African Students at P P Savani University Voting Portal
        </h1>
        <button
          onClick={handleLogout}
          className="py-1 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
      </nav>

      <p className="text-sm text-gray-600 mb-4 text-center">
        {mounted ? countdown : ''}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {hasVoted ? (
        <div className="text-center p-6 bg-green-100 border border-green-400 rounded-lg">
          <p className="text-green-700 font-medium text-xl mb-4">
            Your votes have been recorded. Thank you!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {positions.map(pos => (
            <fieldset key={pos.id} className="mb-6">
              <legend className="text-xl font-semibold mb-2 text-gray-700">
                {pos.title}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pos.candidates.map(cand => (
                  <label
                    key={cand.id}
                    className={`
                      p-4 border rounded-lg flex items-center space-x-4 cursor-pointer
                      ${selections[pos.id] === cand.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300'}
                    `}
                  >
                    <input
                      type="radio"
                      name={`position-${pos.id}`}
                      checked={selections[pos.id] === cand.id}
                      onChange={() => handleSelection(pos.id, cand.id)}
                      className="form-radio h-5 w-5 text-blue-600"
                    />
                    <img
                      src={cand.photoUrl}
                      alt={cand.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium">{cand.name}</p>
                      {cand.party && (
                        <p className="text-sm text-gray-500">{cand.party}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <button
            onClick={handleVote}
            disabled={!votingOpen || loading || Object.keys(selections).length === 0}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Submitting…' : 'Submit Your Vote'}
          </button>
        </div>
      )}
    </div>
  );
}

