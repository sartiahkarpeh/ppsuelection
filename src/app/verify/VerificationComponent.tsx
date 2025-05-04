// src/app/verify/VerificationComponent.tsx
'use client'; // Directive MUST be at the very top

import { useState, FormEvent, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// This is the component containing all the client-side logic
export default function VerificationComponent() {
  const params = useSearchParams();
  const voterId = params.get('voterId') || '';

  const [emailCode, setEmailCode] = useState('');
  const [stage, setStage] = useState<'entry' | 'done'>('entry');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!voterId) {
      setError('Missing voterId parameter in URL. Please use the link from your registration.');
    }
  }, [voterId]);

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!voterId) {
        setError("Cannot verify without a voterId in the URL.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch('/api/verify/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setStage('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'done') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow mt-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Verification Complete!</h1>
        <p className="mb-4">
          You’ve successfully verified your email for the African Students Election at P P Savani University.
        </p>
        <p className="mb-6">
          🗓️ The election will take place on <strong>May 15, 2025</strong>.
          On that day you’ll receive an email containing your Voting Card and a secure link to cast your ballot.
        </p>
        <p className="text-gray-600">
          Please keep an eye on your inbox. We look forward to your participation!
        </p>
      </div>
    );
  }

  // Entry stage UI
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow mt-12">
      <h1 className="text-2xl font-bold mb-4 text-center">Verify Your Email</h1>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          placeholder="Enter verification code"
          value={emailCode}
          onChange={e => setEmailCode(e.target.value)}
          required
          className="w-full p-2 border border-gray-300 rounded-lg"
          aria-label="Verification Code"
        />
        <button
          type="submit"
          disabled={loading || !voterId}
          className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying…' : 'Verify Email'}
        </button>
      </form>
    </div>
  );
}
