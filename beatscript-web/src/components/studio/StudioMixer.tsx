import React from 'react';
import { VolumeX, Volume2 } from 'lucide-react';

interface MixerProps {
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  tracks: { id: string, volume: number, pan: number }[];
  onClose: () => void;
}

export const StudioMixer: React.FC<MixerProps> = ({
  masterVolume, setMasterVolume, isMuted, setIsMuted, tracks, onClose
}) => {
  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 p-12 flex flex-col gap-12 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Studio <span className="text-beatscript-purple">Mixer</span></h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white font-bold tracking-widest">CLOSE [X]</button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-8">
        {/* Master Channel */}
        <div className="w-32 flex flex-col items-center bg-white/5 border border-beatscript-purple/30 rounded-2xl p-6 shrink-0 gap-8">
           <span className="text-[10px] font-black uppercase text-beatscript-purple tracking-widest">Master</span>
           <div className="flex-1 relative flex flex-col items-center">
              <input
                type="range" min="-60" max="6" step="1"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                className="h-full w-1.5 accent-beatscript-purple bg-gray-800 rounded-full appearance-none cursor-pointer vertical-slider"
                style={{ WebkitAppearance: 'slider-vertical' } as any}
              />
           </div>
           <button
             onClick={() => setIsMuted(!isMuted)}
             className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-800 text-gray-500'}`}
           >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
           </button>
        </div>

        {/* Track Channels */}
        {tracks.map(track => (
          <div key={track.id} className="w-28 flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 gap-6">
            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider truncate w-full text-center">{track.id}</span>
            <div className="flex flex-col items-center gap-1 w-full">
               <span className="text-[8px] font-black text-gray-600">PAN</span>
               <input type="range" min="-1" max="1" step="0.1" value={track.pan} onChange={() => {}} className="w-full h-1 accent-gray-500 bg-gray-800 rounded-full appearance-none" />
            </div>
            <div className="flex-1 relative flex flex-col items-center">
               <input
                 type="range" min="-60" max="12" step="1"
                 value={track.volume}
                 onChange={() => {}}
                 className="h-full w-1 accent-white bg-gray-800 rounded-full appearance-none cursor-pointer vertical-slider"
                 style={{ WebkitAppearance: 'slider-vertical' } as any}
               />
            </div>
            <div className="flex gap-1.5 w-full">
               <button className="flex-1 py-1.5 rounded bg-gray-800 text-[8px] font-black text-gray-500 hover:text-white transition-colors">MUTE</button>
               <button className="flex-1 py-1.5 rounded bg-gray-800 text-[8px] font-black text-gray-500 hover:text-white transition-colors">SOLO</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
