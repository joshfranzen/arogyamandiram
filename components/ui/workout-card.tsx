'use client';

import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type WorkoutCardProps = HTMLAttributes<HTMLDivElement>;

export default function WorkoutCard({ className, ...props }: WorkoutCardProps) {
  return (
    <div
      className={cn(
        'dashboard-unified-card relative rounded-2xl border text-text-primary',
        'overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}
