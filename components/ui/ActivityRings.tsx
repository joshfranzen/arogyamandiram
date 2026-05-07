'use client';

interface ActivityRingsProps {
  steps: number | null;
  stepsGoal: number;
  calories: number | null;
  caloriesGoal: number;
  distanceKm: number | null;
  distanceGoal: number;
  size?: number;
  stroke?: number;
  gap?: number;
}

interface RingDef {
  value: number;
  goal: number;
  gradFrom: string;
  gradTo: string;
  trackColor: string;
}

export default function ActivityRings({
  steps, stepsGoal, calories, caloriesGoal, distanceKm, distanceGoal,
  size = 180, stroke = 12, gap = 6,
}: ActivityRingsProps) {
  const center = size / 2;
  const radii = [
    center - stroke / 2 - 2,
    center - stroke / 2 - 2 - (stroke + gap),
    center - stroke / 2 - 2 - 2 * (stroke + gap),
  ];

  const rings: RingDef[] = [
    { value: steps ?? 0,      goal: stepsGoal,    gradFrom: '#34d399', gradTo: '#10b981', trackColor: 'rgba(52,211,153,0.10)' },
    { value: calories ?? 0,   goal: caloriesGoal, gradFrom: '#fbbf24', gradTo: '#f59e0b', trackColor: 'rgba(245,158,11,0.10)' },
    { value: distanceKm ?? 0, goal: distanceGoal, gradFrom: '#22d3ee', gradTo: '#06b6d4', trackColor: 'rgba(6,182,212,0.10)' },
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          {rings.map((r, i) => (
            <linearGradient key={`g${i}`} id={`ringGrad${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={r.gradFrom} />
              <stop offset="100%" stopColor={r.gradTo} />
            </linearGradient>
          ))}
        </defs>

        {rings.map((r, i) => {
          const radius = radii[i];
          const circ = 2 * Math.PI * radius;
          const pct = Math.min(1, r.goal > 0 ? r.value / r.goal : 0);
          const dash = circ * pct;
          return (
            <g key={i}>
              <circle cx={center} cy={center} r={radius} stroke={r.trackColor} strokeWidth={stroke} fill="none" />
              <circle
                cx={center} cy={center} r={radius}
                stroke={`url(#ringGrad${i})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
