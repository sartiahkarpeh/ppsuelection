'use client';
import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// Simple regex to check basic UUID format (adjust if your IDs differ)
const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

export default function LoginPage() {
  const router = useRouter();
  const [voterId, setVoterId]         = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  const handleVoterChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setVoterId(e.target.value);
  };
  const handleDobChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDateOfBirth(e.target.value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Front-end validation
    if (!UUID_REGEX.test(voterId)) {
      setError('Invalid Voter ID format.');
      return;
    }
    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, dateOfBirth }),
      });

      // read raw text, then try JSON.parse it
      const text = await res.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Login failed (status ${res.status}).`);
      }

      // **STORE** the returned voter JWT
      if (data.token) {
        localStorage.setItem('voter_token', data.token);
      } else {
        console.warn('Login succeeded but no token was returned.');
      }

      // success!
      router.push('/vote');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md mt-12">
      <h1 className="text-3xl font-bold mb-6 text-center">Login to Vote</h1>
      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Voter ID</label>
          <input
            type="text"
            value={voterId}
            onChange={handleVoterChange}
            placeholder="e.g. 1c1f7901-8289-4487-8577-d485b01e3662"
            required
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Date of Birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={handleDobChange}
            required
            disabled={loading}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-2 rounded-lg 
            bg-blue-600 text-white font-semibold 
            hover:bg-blue-700 disabled:bg-gray-400 
            transition
          "
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}

