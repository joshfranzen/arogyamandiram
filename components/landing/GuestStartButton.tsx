'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

interface GuestStartButtonProps {
  children: React.ReactNode;
  className?: string;
}

export default function GuestStartButton({ children, className }: GuestStartButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    let deviceId = localStorage.getItem('guestDeviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('guestDeviceId', deviceId);
    }
    await signIn('guest', { deviceId, callbackUrl: '/onboarding' });
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {loading ? 'Starting…' : children}
    </button>
  );
}
