'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrchestratorSidebar } from '@/contexts/OrchestratorSidebarContext';

const STORAGE_KEY = 'ai-panda-pos';
const CLICK_THRESHOLD = 5;

function getDefaultPos() {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return { x: window.innerWidth - 84, y: window.innerHeight - 120 };
}

function CuteRedPandaFace() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/red-panda.png" alt="AI assistant" width={84} height={84} style={{ objectFit: 'contain' }} />
  );
}

export default function OrchestratorToggleButton() {
  const { isOpen, toggleSidebar } = useOrchestratorSidebar();

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  const isDragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let saved: { x: number; y: number } | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      // ignore
    }
    setPos(saved ?? getDefaultPos());
    setMounted(true);
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const size = 84;
    return {
      x: Math.max(0, Math.min(x, window.innerWidth - size)),
      y: Math.max(0, Math.min(y, window.innerHeight - size)),
    };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = ev.clientX - startMouse.current.x;
      const dy = ev.clientY - startMouse.current.y;
      setPos(clamp(startPos.current.x + dx, startPos.current.y + dy));
    };

    const onMouseUp = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const dx = ev.clientX - startMouse.current.x;
      const dy = ev.clientY - startMouse.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const finalPos = clamp(startPos.current.x + dx, startPos.current.y + dy);
      setPos(finalPos);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        // ignore
      }

      if (dist < CLICK_THRESHOLD) {
        toggleSidebar();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [pos, clamp, toggleSidebar]);

  if (!mounted || isOpen) return null;

  return (
    <div
      className="fixed z-[60] hidden lg:block select-none group"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Dream thought bubble */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none opacity-0 group-hover:opacity-84 transition-opacity duration-300">
        {/* extra top padding so filter shadow isn't clipped */}
        <div style={{ paddingTop: 10 }}>
          <svg
            width="108" height="88" viewBox="0 0 108 88" fill="none"
            overflow="visible"
            style={{ filter: 'drop-shadow(0 0 10px rgba(74,222,84,0.2)) drop-shadow(0 3px 10px rgba(0,0,0,0.55))' }}
          >
            {/* Single cloud: overlapping circles same fill */}
            <g fill="#213d2b">
              <circle cx="20"  cy="34" r="14" />
              <circle cx="36"  cy="22" r="17" />
              <circle cx="54"  cy="16" r="19" />
              <circle cx="84"  cy="22" r="17" />
              <circle cx="88"  cy="34" r="13" />
              <circle cx="30"  cy="47" r="16" />
              <circle cx="54"  cy="51" r="17" />
              <circle cx="78"  cy="47" r="16" />
            </g>

            {/* Thought dots */}
            <circle cx="54" cy="73" r="4"   fill="#213d2b" />
            <circle cx="54" cy="82" r="2.8" fill="#213d2b" />
            <circle cx="54" cy="88" r="1.8" fill="#213d2b" />

            {/* Text — foreignObject spans full cloud area; div uses explicit px so flex centers properly */}
            <foreignObject x="0" y="0" width="108" height="66">
              <div
                // @ts-expect-error xmlns required for SVG foreignObject
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  width: '108px',
                  height: '66px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'rgba(167,243,208,0.95)',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {"I'm your AI ✨"}
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>

      <button
        onMouseDown={onMouseDown}
        aria-label="Open AI assistant"
        className="flex items-center justify-center w-[84px] h-[84px] cursor-grab active:cursor-grabbing bg-transparent border-none p-0"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
      >
        <CuteRedPandaFace />
      </button>
    </div>
  );
}
