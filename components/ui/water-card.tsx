 'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type WaterCardProps = HTMLAttributes<HTMLDivElement>;

export default function WaterCard({ className, ...props }: WaterCardProps) {
  return (
    <div
      className={cn(
        'dashboard-unified-card relative overflow-hidden rounded-2xl border text-white',
        className,
      )}
      {...props}
    />
  );
}
