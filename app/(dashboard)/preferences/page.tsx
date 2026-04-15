'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PreferencesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=notifications'); }, [router]);
  return null;
}
