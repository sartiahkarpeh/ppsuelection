// src/app/verify/page.tsx

import { Suspense } from 'react';
import VerificationComponent from './VerificationComponent'; // Import the new client component

// This default export remains a Server Component
export default function VerifyPage() {
  return (
    // Wrap the Client Component in Suspense
    <Suspense fallback={<div className="text-center mt-12">Loading...</div>}>
      <VerificationComponent />
    </Suspense>
  );
}
