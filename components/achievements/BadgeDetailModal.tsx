'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { UserBadge } from '@/types';

interface BadgeDetailModalProps {
  badge: UserBadge | null;
  onClose: () => void;
}

export function BadgeDetailModal({ badge, onClose }: BadgeDetailModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!badge) return null;

  const earnedDate = badge.earnedAt
    ? new Date(badge.earnedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-[90] rounded-lg bg-black/60 p-1.5 text-text-muted shadow-md transition-colors hover:bg-black/80 hover:text-text-primary"
        aria-label="Close badge details"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-[80] flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-black/55 p-6 backdrop-blur-md sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/badges/${badge.id}.svg`}
          alt={badge.name}
          className="h-56 w-56 select-none sm:h-64 sm:w-64"
          draggable={false}
        />
        <p className="text-center text-sm text-text-secondary">{badge.description}</p>
        {earnedDate && (
          <p className="text-[11px] uppercase tracking-wider text-text-muted">
            Earned {earnedDate}
          </p>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
