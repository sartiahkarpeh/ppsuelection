// src/app/register/page.tsx
'use client';

import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    photoUrl: '',
    universityId: '',
    email: '',
    course: '',
    phoneNumber: '',
    dateOfBirth: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Timer state
  const [countdown, setCountdown] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // mark mounted to avoid SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Registration window: starts today 00:00 and ends 7 days later at 23:59
  useEffect(() => {
    if (!mounted) return;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + 0);
    end.setHours(0, 38, 59, 999);

    function updateTimer() {
      const n = new Date();
      if (n < start) {
        setRegistrationOpen(false);
        const diff = start.getTime() - n.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdown(`Registration starts in ${days}d ${hours}h ${mins}m ${secs}s`);
      } else if (n <= end) {
        setRegistrationOpen(true);
        const diff = end.getTime() - n.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdown(`${days}d ${hours}h ${mins}m ${secs}s until close`);
      } else {
        setRegistrationOpen(false);
        setCountdown('Registration has closed');
      }
    }

    updateTimer();
    const tid = setInterval(updateTimer, 1000);
    return () => clearInterval(tid);
  }, [mounted]);

  // Handle input changes, auto-fill email
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'universityId') {
      const uni = value.trim();
      setFormData(prev => ({
        ...prev,
        universityId: uni,
        email: uni ? `${uni}@ppsu.ac.in` : '',
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Photo preview
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoPreview('');
      setFormData(prev => ({ ...prev, photoUrl: '' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setFormData(prev => ({ ...prev, photoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registrationOpen) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      router.push(`/verify?voterId=${data.voterId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md mt-12">
      <h1 className="text-3xl font-bold mb-6 text-center">Register to Vote</h1>
      {/* Timer display */}
      {mounted && (
        <p className="text-center text-sm text-gray-600 mb-4">{countdown}</p>
      )}
      {/* Disable form when closed */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          name="fullName"
          type="text"
          placeholder="Full Name"
          value={formData.fullName}
          onChange={handleChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />

        <input
          name="photoUrl"
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg cursor-pointer"
        />
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Photo Preview"
            className="mt-2 w-24 h-24 object-cover rounded-lg border"
          />
        )}

        <input
          name="universityId"
          type="text"
          placeholder="University ID"
          value={formData.universityId}
          onChange={handleChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />

        <input
          name="email"
          type="email"
          placeholder="@ppsu.ac.in"
          value={formData.email}
          readOnly
          className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg"
        />

        <input
          name="course"
          type="text"
          placeholder="Course of Study"
          value={formData.course}
          onChange={handleChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />

        <input
          name="phoneNumber"
          type="tel"
          placeholder="Phone Number"
          value={formData.phoneNumber}
          onChange={handleChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />

        <input
          name="dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={handleChange}
          required
          disabled={!registrationOpen}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />

        <button
          type="submit"
          disabled={!registrationOpen || loading}
          className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Registering...' : registrationOpen ? 'Register' : 'Closed'}
        </button>
      </form>
    </div>
  );
}

