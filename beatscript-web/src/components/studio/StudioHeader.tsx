import React, { useState } from 'react';
import * as Tone from 'tone';
import { Music, VolumeX, Volume2, Play, Square, Share2, Check } from 'lucide-react';

interface HeaderProps {
  bpm: number;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const StudioHeader: React.FC<HeaderProps> = ({
  bpm, isMuted, setIsMuted, masterVolume, setMasterVolume, isPlaying, onTogglePlay
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-[#111111]">
      <div className="flex items-center gap-4">
        <div className="bg-beatscript-purple p-2 rounded-lg shadow-lg shadow-purple-500/20"><Music size={24} /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tighter">BeatScript <span className="text-beatscript-purple italic">v12.8</span></h1>
          <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Studio Engine Pro</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
          <span className="text-[10px] text-beatscript-purple font-bold">BPM</span>
          <span className="text-sm font-mono">{bpm}</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => { setIsMuted(!isMuted); Tone.Destination.mute = !isMuted; }}
            className="text-gray-500 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX size={18} className="text-red-500" /> : <Volume2 size={18} />}
          </button>
          <input
            type="range" min="-60" max="0" value={masterVolume}
            onChange={(e) => { setMasterVolume(parseInt(e.target.value)); Tone.Destination.volume.value = parseInt(e.target.value); }}
            className="w-24 accent-beatscript-purple h-1 bg-gray-800 rounded-full appearance-none cursor-pointer"
          />
        </div>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs bg-white/5 hover:bg-white/10 transition-all border border-white/10"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
          {copied ? 'COPIED' : 'SHARE'}
        </button>

        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-2 px-10 py-2.5 rounded-full font-black transition-all shadow-xl ${
            isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-beatscript-purple hover:bg-purple-600 shadow-purple-500/30'
          }`}
        >
          {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>
      </div>
    </header>
  );
};
