import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import Editor from '@monaco-editor/react';
import { Play, Square, Music, Cpu, Zap, Activity } from 'lucide-react';

interface BeatScript {
  tempo?: number;
  layers?: string[];
  patterns?: Record<string, string>;
  melody?: string[];
  loop?: number;
  composition?: any;
}

const DEFAULT_SCRIPT = `composition {
  title: "Neon Sunset",
  bpm: 95
}

section main {
  length: 4
  track kick {
    instrument: "kick_synth",
    pattern: "1000100010101000"
  }
  track snare {
    instrument: "snare_synth",
    pattern: "0000100000001000"
  }
  track hihat {
    instrument: "hihat_synth",
    pattern: "1111111111111111"
  }
  track lead {
    instrument: "melody_synth",
    pattern: ["C3", "Eb3", "G3", "Bb3", "G3", "Eb3", "F3", "D3"]
  }
}

timeline: ["main"]
`;

const BeatScriptApp: React.FC = () => {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  // Audio nodes
  const synths = useRef<Record<string, any>>({});

  useEffect(() => {
    // Setup Tone.js
    synths.current = {
      lead: new Tone.PolySynth(Tone.Synth).toDestination(),
      kick: new Tone.MembraneSynth().toDestination(),
      snare: new Tone.MetalSynth().toDestination(),
      hihat: new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: 0.1,
          release: 0.01
        }
      }).toDestination()
    };

    return () => {
      Object.values(synths.current).forEach(s => s.dispose());
      Tone.Transport.stop();
    };
  }, []);

  const parseBeatScript = (str: string): BeatScript => {
    const res: any = { patterns: {}, layers: [] };

    // Very basic block-aware parser
    const compositionMatch = str.match(/composition\s*\{([^}]*)\}/);
    if (compositionMatch) {
      const content = compositionMatch[1];
      const bpmMatch = content.match(/bpm:\s*(\d+)/);
      if (bpmMatch) res.tempo = parseInt(bpmMatch[1], 10);
    }

    const sectionsMatch = str.matchAll(/section\s+(\w+)\s*\{([^}]*)\}/g);
    for (const match of sectionsMatch) {
      const sectionContent = match[2];
      const tracksMatch = sectionContent.matchAll(/track\s+(\w+)\s*\{([^}]*)\}/g);
      for (const tMatch of tracksMatch) {
        const trackName = tMatch[1];
        const trackContent = tMatch[2];

        res.layers.push(trackName);

        const patMatch = trackContent.match(/pattern:\s*(".*"|\[.*\])/);
        if (patMatch) {
          let val = patMatch[1];
          if (val.startsWith('"')) {
             res.patterns[trackName] = val.slice(1, -1);
          } else {
             try {
               res.melody = JSON.parse(val.replace(/'/g, '"'));
             } catch (e) {}
          }
        }
      }
    }

    return res;
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      setIsPlaying(false);
      return;
    }

    await Tone.start();
    const beat = parseBeatScript(script);
    const tempo = beat.tempo || 120;
    setBpm(tempo);
    Tone.Transport.bpm.value = tempo;

    const layers = beat.layers || [];
    const patterns = beat.patterns || {};
    const melody = beat.melody || [];

    const sequence = new Tone.Sequence((time, step) => {
      layers.forEach(layer => {
        const pattern = patterns[layer];

        if (pattern) {
          const hit = pattern[step % pattern.length];
          if (hit === '1') {
            const synth = layer === 'kick' ? synths.current.kick :
                          layer === 'snare' ? synths.current.snare :
                          synths.current.hihat;
            synth.triggerAttackRelease(layer === 'kick' ? 'C1' : 'C2', "16n", time);
          }
        } else if (layer === 'lead') {
          const note = melody[Math.floor(step / 2) % melody.length];
          if (note) {
            synths.current.lead.triggerAttackRelease(note, "16n", time);
          }
        }
      });
    }, Array.from({ length: 16 }, (_, i) => i), "16n");

    sequence.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-beatscript-black text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-beatscript-gray border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-beatscript-purple p-2 rounded-lg">
            <Music size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BeatScript <span className="text-beatscript-purple italic">v12</span></h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Activity size={16} className="text-green-500" />
            <span>Engine: Tone.js (Web)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 font-mono bg-black/40 px-3 py-1 rounded border border-white/5">
            <span>BPM: {bpm}</span>
          </div>
          <button
            onClick={handleTogglePlay}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold transition-all ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-beatscript-purple hover:bg-purple-600'
            }`}
          >
            {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-white/10">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/20 text-xs font-mono text-gray-500 border-b border-white/5">
            <Cpu size={14} />
            <span>main.beat</span>
          </div>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={script}
            onChange={(v) => setScript(v || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
              padding: { top: 20 }
            }}
          />
        </div>

        {/* Projection Area */}
        <div className="w-96 bg-beatscript-gray flex flex-col p-6 gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-yellow-500" />
              Projection
            </h2>
            <p className="text-xs text-gray-400 italic">Reactive UI based on cursor position</p>
          </div>

          <div className="flex-1 bg-black/40 rounded-xl border border-white/5 flex items-center justify-center text-center p-8">
            <div className="flex flex-col gap-4 opacity-40">
              <Activity size={48} className="mx-auto" />
              <p className="text-sm">Select a part of your code to see its parameters projected here.</p>
            </div>
          </div>

          {/* Visualization placeholder */}
          <div className="h-32 bg-black/20 rounded-xl border border-white/5 p-4 flex items-end gap-1">
             {Array.from({length: 24}).map((_, i) => (
               <div
                 key={i}
                 className={`flex-1 rounded-t-sm transition-all duration-300 ${isPlaying ? 'bg-beatscript-purple' : 'bg-gray-700'}`}
                 style={{
                   height: isPlaying ? `${Math.random() * 80 + 20}%` : '10%',
                   opacity: isPlaying ? 0.6 + (Math.random() * 0.4) : 0.3
                 }}
               />
             ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 bg-beatscript-gray border-t border-white/10 text-[10px] text-gray-500 flex justify-between">
        <div>BEATSCRIPT CORE v12.0.4-LATEST</div>
        <div className="flex gap-4">
          <span className="hover:text-gray-300 cursor-pointer transition-colors">DOCUMENTATION</span>
          <span className="hover:text-gray-300 cursor-pointer transition-colors">SETTINGS</span>
          <span className="text-beatscript-purple hover:underline cursor-pointer">GEMINI-POWERED CO-PILOT ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};

export default BeatScriptApp;
