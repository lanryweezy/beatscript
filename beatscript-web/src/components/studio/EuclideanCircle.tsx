import React from 'react';

interface EuclideanCircleProps {
  k: number;
  n: number;
  rotate: number;
  currentStep?: number;
  color?: string;
}

export const EuclideanCircle: React.FC<EuclideanCircleProps> = ({
  k, n, rotate, currentStep = -1, color = "#8b5cf6"
}) => {
  const radius = 40;
  const center = 50;

  const generatePattern = () => {
    let pattern = [];
    for (let i = 0; i < n; i++) {
      pattern.push(Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) ? 1 : 0);
    }
    for (let i = 0; i < rotate; i++) {
      const last = pattern.pop();
      if (last !== undefined) pattern.unshift(last);
    }
    return pattern;
  };

  const pattern = generatePattern();

  return (
    <div className="aspect-square w-full max-w-[200px] mx-auto relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {pattern.map((bit, i) => {
          const angle = (i / n) * 2 * Math.PI;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const isActive = bit === 1;
          const isCurrent = currentStep % n === i;

          return (
            <g key={i}>
              <circle
                cx={x} cy={y}
                r={isActive ? 3 : 1.5}
                fill={isCurrent ? "white" : (isActive ? color : "rgba(255,255,255,0.1)")}
                className="transition-all duration-200"
              />
              {isActive && (
                 <circle
                   cx={x} cy={y} r={isCurrent ? 6 : 4}
                   fill={color} fillOpacity={isCurrent ? 0.4 : 0.1}
                   className="animate-pulse"
                 />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
         <span className="text-xl font-black text-white/20">{k}</span>
         <div className="h-[1px] w-4 bg-white/10" />
         <span className="text-xs font-bold text-white/10">{n}</span>
      </div>
    </div>
  );
};
