import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import Editor, { loader } from '@monaco-editor/react';
import {
  Zap, Activity, FolderOpen, Sliders, Layout, Save, Download
} from 'lucide-react';

import { parseBeatScriptEnhanced } from './core/parser_v2';
import { exportToMidi } from './core/midi_export';
import { ADSRVisualizer } from './components/studio/ADSRVisualizer';
import { EuclideanCircle } from './components/studio/EuclideanCircle';
import { ProjectLibrary } from './components/studio/ProjectLibrary';
import { StudioMixer } from './components/studio/StudioMixer';
import { StudioHeader } from './components/studio/StudioHeader';

const PRESETS: Record<string, string> = {
  "Neon Sunset": `composition {
  title: "Neon Sunset",
  bpm: 95
}

synth kick_synth {
  type: "membrane",
  frequency: 50,
  attack: 0.01,
  decay: 0.2
}

synth snare_synth {
  type: "noise",
  decay: 0.1,
  attack: 0.005
}

fx_chain room {
  reverb { roomSize: 0.7, wet: 0.4 }
}

section main {
  length: 4
  track kick {
    instrument: "kick_synth",
    pattern: "1000100010101000"
  }
  track snare {
    instrument: "snare_synth",
    send: { to: "room", amount: 0.5 },
    pattern: "0000100000001000"
  }
}

timeline: ["main"]`,
  "Berlin Underground": `composition {
  title: "Berlin Underground",
  bpm: 128
}

synth acid_bass {
  type: "subtractive",
  cutoff: 400,
  resonance: 15,
  attack: 0.001,
  decay: 0.2
}

synth drum {
  type: "membrane",
  decay: 0.15
}

section main {
  length: 4
  track bassline {
    instrument: "acid_bass",
    pattern: [C2, C2, C3, _, C2, _, C3, _, C2, C2, C3, _, C2, Eb2, F2, _]
  }
  track kick {
    instrument: "drum",
    pattern: "1000100010001000"
  }
}

timeline: ["main"]`,
  "Euclidean Magic": `composition {
  title: "Euclidean Magic",
  bpm: 120
}

synth kick { type: "membrane" }
synth hat { type: "noise", decay: 0.05 }

section main {
  length: 4
  track kick {
    instrument: "kick",
    pattern: euclidean(3, 8)
  }
  track hihat {
    instrument: "hat",
    pattern: euclidean(5, 8)
  }
}

timeline: ["main"]`
};

const toBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
const fromBase64 = (str: string) => decodeURIComponent(escape(atob(str)));

const BeatScriptApp: React.FC = () => {
  const [script, setScript] = useState(() => {
    const hash = window.location.hash.slice(1);
    if (hash) { try { return fromBase64(hash); } catch (e) { } }
    const lastSession = localStorage.getItem('beatscript_last_session');
    if (lastSession) return lastSession;
    return PRESETS["Neon Sunset"];
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [bpmState, setBpmState] = useState(95);
  const [projection, setProjection] = useState<any>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(32).fill(0));
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<{msg: string, type: 'info' | 'error'}[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [masterVolume, setMasterVolume] = useState(-6);
  const [isMuted, setIsMuted] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [projects, setProjects] = useState<Record<string, string>>(() => {
     const saved = localStorage.getItem('beatscript_projects');
     return saved ? JSON.parse(saved) : {};
  });

  const editorRef = useRef<any>(null);
  const synths = useRef<Record<string, any>>({});
  const effects = useRef<Record<string, any>>({});
  const analyser = useRef<Tone.Analyser | null>(null);
  const limiter = useRef<Tone.Limiter | null>(null);
  const recorder = useRef<Tone.Recorder | null>(null);
  const activeSequences = useRef<Map<string, Tone.Sequence>>(new Map());

  useEffect(() => {
    analyser.current = new Tone.Analyser('waveform', 32);
    limiter.current = new Tone.Limiter(-1).toDestination();
    analyser.current.connect(limiter.current);

    recorder.current = new Tone.Recorder();
    Tone.Destination.connect(recorder.current);

    const interval = setInterval(() => {
      if (analyser.current && isPlaying) {
        const values = analyser.current.getValue() as Float32Array;
        setVisualizerData(Array.from(values).map(v => Math.abs(v) * 100));
      } else if (!isPlaying) {
        setVisualizerData(new Array(32).fill(0).map(() => Math.random() * 5));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const updateProjection = useCallback((line: string, lineNumber: number, currentScript: string) => {
    const lines = currentScript.split('\n');
    if (line.includes('bpm:')) {
      setProjection({ type: 'knob', label: 'Tempo', value: parseInt(line.split(':')[1]), min: 40, max: 240, lineNumber });
    } else if (line.includes('decay:') || line.includes('attack:') || line.includes('sustain:') || line.includes('release:')) {
      let start = -1;
      for(let i = lineNumber-1; i>=0; i--) if(lines[i].includes('synth')) { start = i; break; }
      const synthLines = [];
      if (start !== -1) {
        for(let i = start; i < lines.length && !lines[i].includes('}'); i++) synthLines.push(lines[i]);
      }
      const getVal = (p: string) => {
        const l = synthLines.find(ln => ln.includes(p));
        return l ? parseFloat(l.split(':')[1]) : 0.5;
      };
      setProjection({ type: 'adsr', label: 'Envelope', attack: getVal('attack'), decay: getVal('decay'), sustain: getVal('sustain'), release: getVal('release'), lineNumber });
    } else if (line.includes('cutoff:') || line.includes('resonance:')) {
       const val = parseFloat(line.split(':')[1]);
       setProjection({ type: 'knob', label: line.includes('cutoff') ? 'Filter Cutoff' : 'Filter Resonance', value: val, min: line.includes('cutoff') ? 20 : 0, max: line.includes('cutoff') ? 20000 : 20, lineNumber });
    } else if (line.includes('pattern:')) {
      const val = line.split(':')[1].trim();
      if (val.startsWith('euclidean')) {
        const p = val.match(/\(([^)]*)\)/);
        if (p) {
          const [k, n, r] = p[1].split(',').map(s => parseInt(s.trim()));
          setProjection({ type: 'euclidean', label: 'Euclidean', k: k||0, n: n||16, rotate: r||0, lineNumber });
        }
      } else {
        setProjection({ type: 'pattern', label: 'Pattern', value: val.replace(/^["']|["']$/g, ''), lineNumber });
      }
    } else {
      setProjection(null);
    }
  }, []);

  const handleProjectionValueChange = (newValue: any) => {
    if (!projection) return;
    const lines = script.split('\n');
    const line = lines[projection.lineNumber - 1];
    const parts = line.split(':');
    if (parts.length === 2) {
      const indent = parts[0].match(/^\s*/)?.[0] || '';
      const key = parts[0].trim();
      lines[projection.lineNumber - 1] = `${indent}${key}: ${typeof newValue === 'string' && key === 'pattern' ? `"${newValue}"` : newValue}`;
      const newScript = lines.join('\n');
      setScript(newScript);
      window.history.replaceState(null, '', `#${toBase64(newScript)}`);
      updateProjection(lines[projection.lineNumber - 1], projection.lineNumber, newScript);
    }
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (isRecording && recorder.current) {
         const blob = await recorder.current.stop();
         const url = URL.createObjectURL(blob);
         const anchor = document.createElement("a");
         anchor.download = "recording.webm";
         anchor.href = url;
         anchor.click();
         setIsRecording(false);
      }
      Tone.Transport.stop();
      Tone.Transport.cancel();
      activeSequences.current.forEach(s => s.dispose());
      activeSequences.current.clear();
      Object.values(synths.current).forEach(s => s.dispose());
      synths.current = {};
      setIsPlaying(false);
      return;
    }
    await Tone.start();
    const parseResult = parseBeatScriptEnhanced(script);
    if (parseResult.error) {
      setConsoleLogs(prev => [{msg: parseResult.error!, type: 'error'}, ...prev]);
      setShowConsole(true);
      return;
    }
    const beat = parseResult.data!;
    setBpmState(beat.bpm);
    Tone.Transport.bpm.value = beat.bpm;

    // Instantiate FX Chains
    if (beat.fx_chains) {
      Object.entries(beat.fx_chains).forEach(([name, chain]: [string, any[]]) => {
        const nodes = chain.map(fx => {
          if (fx.type === 'reverb') return new Tone.Reverb({ roomSize: fx.roomSize || 0.5, wet: fx.wet || 1 });
          if (fx.type === 'delay') return new Tone.FeedbackDelay({ delayTime: fx.delayTime || 0.25, feedback: fx.feedback || 0.5, wet: fx.wet || 1 });
          return null;
        }).filter(n => n !== null);
        if (nodes.length > 0) {
           nodes[nodes.length-1].connect(analyser.current!);
           for(let i=0; i<nodes.length-1; i++) nodes[i].connect(nodes[i+1]);
           effects.current[name] = nodes[0];
        }
      });
    }

    Object.entries(beat.synths).forEach(([name, config]: [string, any]) => {
      let synth: any;
      const dest = analyser.current!;
      switch (config.type) {
        case 'membrane': synth = new Tone.MembraneSynth().connect(dest); break;
        case 'noise': synth = new Tone.NoiseSynth({ envelope: { decay: config.decay || 0.1 } }).connect(dest); break;
        case 'fm': synth = new Tone.PolySynth(Tone.FMSynth).connect(dest); break;
        case 'mono': synth = new Tone.PolySynth(Tone.MonoSynth).connect(dest); break;
        case 'pluck': synth = new Tone.PluckSynth().connect(dest); break;
        case 'subtractive': {
           const filter = new Tone.Filter(config.cutoff || 20000, "lowpass").connect(dest);
           synth = new Tone.PolySynth(Tone.Synth).connect(filter);
           break;
        }
        default: synth = new Tone.PolySynth(Tone.Synth).connect(dest);
      }
      if (config.decay && synth.envelope) synth.envelope.decay = config.decay;
      synths.current[name] = synth;
    });
    beat.timeline.forEach((sectionName, sectionIndex) => {
      const section = beat.sections[sectionName];
      if (!section) return;
      Object.entries(section.tracks).forEach(([trackName, track]: [string, any]) => {
        const baseSynth = synths.current[track.instrument];
        if (!baseSynth) return;
        const pattern = Array.isArray(track.pattern) ? track.pattern : track.pattern.split('');
        // Setup Sends
        if (track.send && effects.current[track.send.to]) {
           const sendNode = new Tone.Gain(track.send.amount).connect(effects.current[track.send.to]);
           baseSynth.connect(sendNode);
        }

        const seq = new Tone.Sequence((time, noteOrBit) => {
          Tone.Draw.schedule(() => {
            setCurrentStep((prev) => (prev + 1) % pattern.length);
          }, time);
          if (noteOrBit === '1' || (typeof noteOrBit === 'string' && !['0', '_'].includes(noteOrBit))) {
             baseSynth.triggerAttackRelease(noteOrBit === '1' ? "C2" : noteOrBit, "16n", time);
          }
        }, pattern, "16n");
        seq.start(`${sectionIndex * section.length}m`);
        seq.stop(`${(sectionIndex + 1) * section.length}m`);
        activeSequences.current.set(trackName, seq);
      });
    });
    Tone.Transport.loop = true;
    Tone.Transport.start();
    setIsPlaying(true);
  };

  const handleToggleRecord = async () => {
     if (isRecording) {
        handleTogglePlay(); // Stop everything
        return;
     }
     if (!isPlaying) {
        await handleTogglePlay();
     }
     if (recorder.current) {
        recorder.current.start();
        setIsRecording(true);
     }
  };

  const saveProject = (name: string) => {
     const next = { ...projects, [name]: script };
     setProjects(next);
     localStorage.setItem('beatscript_projects', JSON.stringify(next));
  };

  const handleMidiExport = () => {
     const res = parseBeatScriptEnhanced(script);
     if (res.data) {
        const uri = exportToMidi(res.data);
        const link = document.createElement('a');
        link.href = uri;
        link.download = `${res.data.title || 'composition'}.mid`;
        link.click();
     }
  };

  const loadProject = (name: string) => {
     const s = projects[name];
     if (s) {
        setScript(s);
        window.history.replaceState(null, '', `#${toBase64(s)}`);
        setShowLibrary(false);
     }
  };

  const deleteProject = (name: string) => {
     const next = { ...projects };
     delete next[name];
     setProjects(next);
     localStorage.setItem('beatscript_projects', JSON.stringify(next));
  };

  const getMixerTracks = () => {
     const res = parseBeatScriptEnhanced(script);
     if (!res.data) return [];
     const tracks: any[] = [];
     Object.values(res.data.sections).forEach(s => {
        Object.entries(s.tracks).forEach(([name, config]) => {
           tracks.push({ id: name, volume: config.volume || 0, pan: config.pan || 0 });
        });
     });
     return tracks;
  };

  useEffect(() => {
    loader.init().then(monaco => {
      monaco.editor.defineTheme('beatscript-theme', {
        base: 'vs-dark', inherit: true,
        rules: [
          { token: 'keyword', foreground: 'BD93F9', fontStyle: 'bold' },
          { token: 'string', foreground: 'F1FA8C' },
          { token: 'number', foreground: 'BD93F9' },
          { token: 'identifier', foreground: '8BE9FD' },
        ],
        colors: { 'editor.background': '#0a0a0a', 'editor.lineHighlightBackground': '#1a1a1a' }
      });
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen font-sans overflow-hidden bg-[#0a0a0a] text-white">
      {showLibrary && <ProjectLibrary projects={projects} onLoad={loadProject} onSave={saveProject} onDelete={deleteProject} onClose={() => setShowLibrary(false)} />}
      {showMixer && <StudioMixer masterVolume={masterVolume} setMasterVolume={setMasterVolume} isMuted={isMuted} setIsMuted={setIsMuted} tracks={getMixerTracks()} onClose={() => setShowMixer(false)} />}

      <StudioHeader
        bpm={bpmState}
        isMuted={isMuted} setIsMuted={setIsMuted}
        masterVolume={masterVolume} setMasterVolume={setMasterVolume}
        isPlaying={isPlaying} onTogglePlay={handleTogglePlay}
      />

      <main className="flex flex-1 overflow-hidden">
        <div className="w-16 border-r border-white/10 flex flex-col items-center py-8 gap-10 shrink-0 bg-[#111111]">
           <FolderOpen size={22} className="text-gray-500 hover:text-beatscript-purple cursor-pointer transition-colors" onClick={() => setShowLibrary(true)} />
           <Sliders size={22} className="text-gray-500 hover:text-beatscript-purple cursor-pointer transition-colors" onClick={() => setShowMixer(true)} />
           <Activity size={22} className="text-gray-500 hover:text-beatscript-purple cursor-pointer transition-colors" onClick={() => setShowConsole(true)} />
           <Layout size={22} className="text-gray-500 hover:text-beatscript-purple cursor-pointer transition-colors" />
        </div>

        <div className="flex-1 flex flex-col relative">
          <div className="flex items-center justify-between px-6 py-2.5 bg-black/40 border-b border-white/5 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-beatscript-purple" />
               <span>unsaved_composition.beat</span>
            </div>
            <div className="flex gap-4">
               <button onClick={() => { const n = prompt("Save as?"); if(n) saveProject(n); }} className="hover:text-white flex items-center gap-1 uppercase tracking-widest"><Save size={10}/> Save</button>
               <button onClick={handleMidiExport} className="hover:text-white flex items-center gap-1 uppercase tracking-widest"><Download size={10}/> MIDI</button>
               <button onClick={handleToggleRecord} className={`${isRecording ? 'text-red-500 animate-pulse' : 'hover:text-white'} flex items-center gap-1 uppercase tracking-widest`}><Activity size={10}/> {isRecording ? 'Rec...' : 'WAV'}</button>
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="beatscript"
              theme="beatscript-theme"
              value={script}
              onChange={(v) => {
                 const newS = v || '';
                 setScript(newS);
                 localStorage.setItem('beatscript_last_session', newS);
                 window.history.replaceState(null, '', `#${toBase64(newS)}`);
                 if (editorRef.current && projection) {
                    const line = editorRef.current.getModel().getLineContent(projection.lineNumber);
                    updateProjection(line, projection.lineNumber, newS);
                 }
              }}
              onMount={(editor) => {
                editorRef.current = editor;
                editor.onDidChangeCursorPosition((e) => {
                  updateProjection(editor.getModel()?.getLineContent(e.position.lineNumber) || '', e.position.lineNumber, editor.getValue());
                });
              }}
              options={{ minimap: { enabled: false }, fontSize: 15, padding: { top: 20 }, smoothScrolling: true }}
            />
          </div>
        </div>

        <div className="w-[420px] border-l border-white/10 flex flex-col shrink-0 bg-[#111111]">
          <div className="p-8 flex-1 flex flex-col gap-10 overflow-y-auto">
             <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2"><Zap size={14} className="text-yellow-500" /> Projection</h2>
             {projection ? (
                <div className="bg-black/40 rounded-3xl border border-white/5 p-8 flex flex-col gap-8">
                   <span className="text-xl font-black">{projection.label}</span>
                   {projection.type === 'adsr' && (
                      <div className="flex flex-col gap-6">
                         <ADSRVisualizer attack={projection.attack} decay={projection.decay} sustain={projection.sustain} release={projection.release} />
                         <input type="range" min="0" max="2" step="0.01" value={projection.decay} onChange={(e) => handleProjectionValueChange(parseFloat(e.target.value))} className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-full appearance-none cursor-pointer" />
                      </div>
                   )}
                   {projection.type === 'euclidean' && (
                      <div className="flex flex-col gap-8">
                         <EuclideanCircle k={projection.k} n={projection.n} rotate={projection.rotate} currentStep={currentStep} />
                         <input type="range" min="1" max="16" step="1" value={projection.k} onChange={(e) => handleProjectionValueChange(`euclidean(${e.target.value}, ${projection.n})`)} className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-full appearance-none" />
                      </div>
                   )}
                   {projection.type === 'knob' && (
                      <input type="range" min={projection.min} max={projection.max} value={projection.value} onChange={(e) => handleProjectionValueChange(parseInt(e.target.value))} className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-full appearance-none" />
                   )}
                   {projection.type === 'pattern' && (
                      <div className="grid grid-cols-8 gap-2">
                         {projection.value.split('').map((bit: string, i: number) => (
                            <div key={i} onClick={() => { const p = projection.value.split(''); p[i] = p[i] === '1' ? '0' : '1'; handleProjectionValueChange(p.join('')); }} className={`aspect-square rounded border border-white/5 cursor-pointer ${bit === '1' ? 'bg-beatscript-purple' : 'bg-gray-800'}`} />
                         ))}
                      </div>
                   )}
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-4">
                   <Activity size={64} />
                   <p className="text-xs font-black uppercase tracking-widest">Select a line to project</p>
                </div>
             )}
          </div>
          <div className="p-8 border-t border-white/10 bg-black/40">
             <div className="h-28 flex items-end gap-[3px]">
                {visualizerData.map((val, i) => <div key={i} className="flex-1 rounded-t-sm bg-beatscript-purple" style={{ height: `${Math.max(4, val)}%`, opacity: 0.3 + (val / 150) }} />)}
             </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-2.5 border-t border-white/10 flex justify-between items-center text-[10px] font-bold tracking-widest text-gray-600 bg-[#111111]">
        <span>CORE_v12.8.0_ACTIVE</span>
      </footer>

      {showConsole && (
         <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-[100] p-12 flex flex-col gap-8">
            <div className="flex justify-between items-center">
               <h2 className="text-4xl font-black italic tracking-tighter">CONSOLE</h2>
               <button onClick={() => setShowConsole(false)} className="text-gray-500 font-bold">CLOSE [X]</button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 font-mono text-xs">
               {consoleLogs.map((log, i) => <div key={i} className={`p-4 rounded border ${log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>{log.msg}</div>)}
            </div>
         </div>
      )}
    </div>
  );
};

export default BeatScriptApp;
