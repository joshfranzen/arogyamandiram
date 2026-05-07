  interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
  width?: number;
  fillFrom?: string;
}

export default function Sparkline({
  data,
  color,
  height = 32,
  width = 80,
  fillFrom,
}: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ height, width }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  const gradId = `sparkGrad-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom || color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillFrom || color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tail dot */}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2" fill={color} />
    </svg>
  );
}
