'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TargetsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=targets'); }, [router]);
  return null;
}
