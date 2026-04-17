import React from 'react';

interface ADSRVisualizerProps {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  color?: string;
}

export const ADSRVisualizer: React.FC<ADSRVisualizerProps> = ({
  attack,
  decay,
  sustain,
  release,
  color = "#8b5cf6"
}) => {
  const h = 100;

  const aW = Math.max(5, (attack / 2) * 25);
  const dW = Math.max(5, (decay / 2) * 25);
  const sW = 25;
  const rW = Math.max(5, (release / 2) * 25);

  const sH = 100 - (sustain * 100);

  const points = [
    `0,${h}`, // Start
    `${aW},0`, // Attack peak
    `${aW + dW},${sH}`, // Decay to sustain
    `${aW + dW + sW},${sH}`, // Sustain hold
    `${aW + dW + sW + rW},${h}` // Release to end
  ].join(' ');

  return (
    <div className="h-24 w-full bg-black/40 rounded-lg border border-white/5 relative overflow-hidden group">
      <svg className="w-full h-full" viewBox={`0 0 ${aW + dW + sW + rW} 100`} preserveAspectRatio="none">
        <path
          d={`M ${points} L 0,100`}
          fill={`${color}20`}
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none">
         <span className="text-[10px] font-black uppercase tracking-widest text-white">Envelope View</span>
      </div>
    </div>
  );
};
