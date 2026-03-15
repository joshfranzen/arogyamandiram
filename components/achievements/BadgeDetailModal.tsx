'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserBadge } from '@/types';
import { BadgeCard, getRarityFromId } from './BadgeCard';

interface BadgeDetailModalProps {
  badge: UserBadge | null;
  onClose: () => void;
}

export function BadgeDetailModal({ badge, onClose }: BadgeDetailModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    // Reset flip state when a new badge is openedonly 2 l
    setIsFlipped(false);
  }, [badge?.id]);

  if (!badge) return null;

  const rarity = getRarityFromId(badge.id);
  const firstEarnedDate = badge.firstEarnedAt ?? badge.earnedAt;
  const deckClass =
    rarity === 'legendary'
      ? 'deck-card deck-card-legendary'
      : rarity === 'epic'
        ? 'deck-card deck-card-epic'
        : rarity === 'rare'
          ? 'deck-card deck-card-rare'
          : 'deck-card deck-card-common';

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-detail-title"
    >
      <div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Close button floating above the overlay so it is easy to reach on all devices */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-[90] rounded-lg bg-black/60 p-1.5 text-text-muted shadow-md transition-colors hover:bg-black/80 hover:text-text-primary"
        aria-label="Close badge details"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Card container – front = premium BadgeCard, back = details view */}
      <div className="relative z-[80] w-full max-w-xs sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div
          className="badge-card-wrapper cursor-pointer select-none"
          onClick={() => setIsFlipped((prev) => !prev)}
        >
          {!isFlipped ? (
            <BadgeCard badge={badge} />
          ) : (
            <div
              className={cn(
                'portrait-card relative flex h-full w-full flex-col overflow-hidden text-left outline-none',
                deckClass
              )}
            >
              <div className="flex h-full flex-col justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
                <div>
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-text-secondary sm:text-[13px]">
                    {badge.description}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-2 text-[10px] text-text-muted sm:text-[11px]">
                  {firstEarnedDate && (
                    <p>
                      Earned on{' '}
                      {new Date(firstEarnedDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
