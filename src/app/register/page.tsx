// src/app/register/page.tsx
'use client';

import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  // Show instructions alert on first load
  useEffect(() => {
    alert(
      `📝 Welcome to the registration portal. Please follow these steps to register successfully:\n\n` +
      `1. Enter your full name exactly as on your student ID\n` +
      `2. Upload a clear and decent PASSPORT SIZE picture of you\n` +
      `3. Provide your University ID (e.g., 22se02ml120) to auto-fill your email\n` +
      `4. Enter your course of study\n` +
      `5. Provide your phone number\n` +
      `6. Select your date of birth, you MUST be 18yrs and above\n` +
      `7. After you hit register, kindly wait for the next page to load - where you would be asked to verify your email\n` +
      `8. To verify your email, a 6 digit code will be sent to your university email (SPAM FOLDER), copy and paste the code to get your email verified\n` +
      `9. After you have verified your email, you will see a VERIFICATION COMPLETE! Message, after that, you are done!\n\n` +
      `In the event where you are still encountering any any of error while registering, kindly contact the IEC Chairman, Sartiah Karpeh on Whatsapp at +231880229716 or call directly on +919502670249`
    );
  }, []);

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


// Presuming this is part of a React component
// function YourComponent() { // Example component structure

  // Timer state
  const [countdown, setCountdown] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // mark mounted to avoid SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Registration window
  useEffect(() => {
    if (!mounted) return;

    // --- SET THE FIXED END DATE AND TIME (IST) ---
    // Month is 0-indexed, so 4 = May
    // This will be interpreted in the user's local timezone.
    // If the user is in IST, this represents May 20, 2025, 23:59:59 IST.
    const end = new Date(2025, 4, 20, 23, 59, 59);

    // --- Determine the Start Date ---
    // For this example, we'll assume registration started today at midnight.
    // If you have a specific historical start date, use that instead.
    // If registration is simply "ongoing", `start` can be set to a past date.
    const nowForStart = new Date(); // Use a 'now' to define the start relative to current day if needed
    const start = new Date(nowForStart);
    start.setHours(0, 0, 0, 0); // Defaulting to start of today for "Registration starts in" logic
                                  // If registration has been open for a while, set 'start' to that actual past date.
                                  // For example: const start = new Date(2025, 4, 10, 0, 0, 0); // If it started May 10th

    // Log the initialized start and end dates for verification
    console.log("Timer Initialized (times are in your browser's local timezone):");
    console.log("Start Date:", start.toLocaleString());
    console.log("End Date:", end.toLocaleString(), "(Target: May 20, 2025, 23:59:59 IST)");


    function updateTimer() {
      const n = new Date(); // Current moment for each tick

      if (n < start) {
        setRegistrationOpen(false);
        const diff = start.getTime() - n.getTime();
        // Ensure diff is not negative if start is in the past due to configuration
        if (diff <= 0) {
            // Fall through to "n <= end" logic if start time has passed
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const secs = Math.floor((diff / 1000) % 60);
            setCountdown(`Registration starts in ${days}d ${hours}h ${mins}m ${secs}s`);
            return; // Exit here to prevent falling into the next block
        }
      }
      
      // This block will now execute if n >= start
      if (n <= end) {
        setRegistrationOpen(true);
        const diff = end.getTime() - n.getTime();

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        // --- DEBUG LOG for "until close" phase ---
        console.log(
          `REG ENDS IN --- Current Time: ${n.toLocaleString()}\n` +
          `Diff (ms): ${diff}\n` +
          `Calculated: Days=${days}, Hours=${hours}, Mins=${mins}, Secs=${secs}`
        );
        // --- END DEBUG LOG ---

        setCountdown(`${days}d ${hours}h ${mins}m ${secs}s until close`);
      } else {
        setRegistrationOpen(false);
        setCountdown('Registration has closed');
        console.log("Registration has officially closed according to timer.");
        // clearInterval(tid); // Already handled by effect cleanup, but can be explicit if needed
      }
    }

    updateTimer(); // Call once immediately
    const tid = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(tid);
      console.log("Timer interval cleared.");
    };
  }, [mounted]);

  // return (<div>{countdown}</div>); // Example usage
// }

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

