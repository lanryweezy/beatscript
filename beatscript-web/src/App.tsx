import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import Editor, { loader } from '@monaco-editor/react';
import { Play, Square, Music, Cpu, Zap, Activity, Download, Settings, BookOpen, Copy, Check, Sparkles, Circle } from 'lucide-react';

// --- Types ---
interface BeatScript {
  bpm: number;
  sections: Record<string, Section>;
  synths: Record<string, any>;
  timeline: string[];
}

interface Section {
  length: number;
  tracks: Record<string, Track>;
}

interface Track {
  instrument: string;
  pattern: string | string[];
}

// --- Presets ---
const PRESETS = {
  "Neon Sunset": `composition {
  title: "Neon Sunset",
  bpm: 95
}

synth kick_synth {
  type: "membrane",
  frequency: 50
}

synth snare_synth {
  type: "noise",
  decay: 0.1
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

timeline: ["main"]`,
  "Deep Techno": `composition {
  title: "Deep Techno",
  bpm: 128
}

synth kick { type: "membrane", frequency: 45 }
synth clap { type: "noise", decay: 0.2 }
synth bass { type: "mono", frequency: 80 }

section loop {
  length: 4
  track bd { instrument: "kick", pattern: "1000100010001000" }
  track cp { instrument: "clap", pattern: "0000100000001000" }
  track bs { instrument: "bass", pattern: "1010010010100101" }
}

timeline: ["loop", "loop"]`,
  "Ambient Clouds": `composition {
  title: "Ambient Clouds",
  bpm: 60
}

synth pad { type: "fm", frequency: 440 }

section atmosphere {
  length: 8
  track pad_layer {
    instrument: "pad",
    pattern: ["C3", "_", "G3", "_", "Bb3", "_", "F3", "_"]
  }
}

timeline: ["atmosphere"]`
};

const DEFAULT_SCRIPT = PRESETS["Neon Sunset"];

const BeatScriptApp: React.FC = () => {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(95);
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 });
  const [projection, setProjection] = useState<any>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(32).fill(0));
  const [copied, setCopied] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const editorRef = useRef<any>(null);

  // Audio nodes
  const synths = useRef<Record<string, any>>({});
  const analyser = useRef<Tone.Analyser | null>(null);
  const recorder = useRef<Tone.Recorder | null>(null);
  const activeSequences = useRef<Map<string, Tone.Sequence>>(new Map());

  useEffect(() => {
    // Setup Tone.js
    analyser.current = new Tone.Analyser('waveform', 32);
    recorder.current = new Tone.Recorder();
    Tone.Destination.connect(recorder.current);

    synths.current = {
      melody_synth: new Tone.PolySynth(Tone.Synth).connect(analyser.current!).toDestination(),
      kick_synth: new Tone.MembraneSynth().connect(analyser.current!).toDestination(),
      snare_synth: new Tone.MetalSynth().connect(analyser.current!).toDestination(),
      hihat_synth: new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: 0.1,
          release: 0.01
        }
      }).connect(analyser.current!).toDestination(),
      bass_synth: new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, release: 0.1 }
      }).connect(analyser.current!).toDestination(),
      pad_synth: new Tone.PolySynth(Tone.FMSynth).connect(analyser.current!).toDestination(),
      kick: new Tone.MembraneSynth().connect(analyser.current!).toDestination(),
      clap: new Tone.MetalSynth({ envelope: { decay: 0.2 } }).connect(analyser.current!).toDestination(),
      bass: new Tone.MonoSynth().connect(analyser.current!).toDestination(),
      pad: new Tone.PolySynth(Tone.FMSynth).connect(analyser.current!).toDestination()
    };

    const interval = setInterval(() => {
      if (analyser.current && isPlaying) {
        const values = analyser.current.getValue() as Float32Array;
        const normalized = Array.from(values).map(v => Math.abs(v) * 100);
        setVisualizerData(normalized);
      } else if (!isPlaying) {
        setVisualizerData(new Array(32).fill(0).map(() => Math.random() * 5));
      }
    }, 50);

    return () => {
      clearInterval(interval);
      Object.values(synths.current).forEach(s => s.dispose());
      Tone.Transport.stop();
    };
  }, [isPlaying]);

  // Robust-ish parser
  const parseBeatScript = (str: string): BeatScript => {
    const res: BeatScript = { bpm: 120, sections: {}, synths: {}, timeline: [] };

    // Remove comments
    const cleanStr = str.replace(/\/\/.*$/gm, '');

    // Parse composition
    const compMatch = cleanStr.match(/composition\s*\{([^}]*)\}/);
    if (compMatch) {
      const bpmMatch = compMatch[1].match(/bpm:\s*(\d+)/);
      if (bpmMatch) res.bpm = parseInt(bpmMatch[1], 10);
    }

    // Parse sections
    const sectionsMatch = cleanStr.matchAll(/section\s+(\w+)\s*\{([^}]*)\}/g);
    for (const match of sectionsMatch) {
      const sectionName = match[1];
      const sectionContent = match[2];
      const section: Section = { length: 4, tracks: {} };

      const lenMatch = sectionContent.match(/length:\s*(\d+)/);
      if (lenMatch) section.length = parseInt(lenMatch[1], 10);

      const tracksMatch = sectionContent.matchAll(/track\s+(\w+)\s*\{([^}]*)\}/g);
      for (const tMatch of tracksMatch) {
        const trackName = tMatch[1];
        const trackContent = tMatch[2];
        const track: Track = { instrument: '', pattern: '' };

        const instMatch = trackContent.match(/instrument:\s*["']?(\w+)["']?/);
        if (instMatch) track.instrument = instMatch[1];

        const decayMatch = trackContent.match(/decay:\s*(\d+\.?\d*)/);
        if (decayMatch && synths.current[track.instrument]) {
           // Dynamic parameter update simulation
        }

        const patMatch = trackContent.match(/pattern:\s*(["'][\d]+["']|\[[^\]]*\])/);
        if (patMatch) {
          const val = patMatch[1].trim();
          if (val.startsWith('"') || val.startsWith("'")) {
            track.pattern = val.slice(1, -1);
          } else {
            try {
              // Handle identifiers in array like [C3, _, Eb3]
              const arrayContent = val.slice(1, -1);
              track.pattern = arrayContent.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } catch (e) {}
          }
        }
        section.tracks[trackName] = track;
      }
      res.sections[sectionName] = section;
    }

    // Parse timeline
    const timelineMatch = cleanStr.match(/timeline:\s*\[([^\]]*)\]/);
    if (timelineMatch) {
      res.timeline = timelineMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }

    return res;
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (isRecording) {
        handleToggleRecording();
      }
      Tone.Transport.stop();
      Tone.Transport.cancel();
      activeSequences.current.forEach(s => s.dispose());
      activeSequences.current.clear();
      setIsPlaying(false);
      return;
    }

    await Tone.start();
    const beat = parseBeatScript(script);
    setBpm(beat.bpm);
    Tone.Transport.bpm.value = beat.bpm;

    if (beat.timeline.length === 0) return;

    // Build loops for each section/track
    beat.timeline.forEach((sectionName, sectionIndex) => {
      const section = beat.sections[sectionName];
      if (!section) return;

      Object.entries(section.tracks).forEach(([trackName, track]) => {
        const synth = synths.current[track.instrument];
        if (!synth) return;

        const pattern = Array.isArray(track.pattern) ? track.pattern : track.pattern.split('');

        const seq = new Tone.Sequence((time, noteOrBit) => {
          if (noteOrBit === '1') {
            synth.triggerAttackRelease(track.instrument.includes('kick') ? 'C1' : 'C2', "16n", time);
          } else if (noteOrBit !== '0' && noteOrBit !== '_') {
            synth.triggerAttackRelease(noteOrBit, "16n", time);
          }
        }, pattern, "16n");

        seq.start(`${sectionIndex * section.length}m`);
        seq.stop(`${(sectionIndex + 1) * section.length}m`);
        activeSequences.current.set(`${sectionName}_${trackName}`, seq);
      });
    });

    Tone.Transport.loop = true;
    Tone.Transport.loopEnd = `${beat.timeline.length * (beat.sections[beat.timeline[0]]?.length || 4)}m`;
    Tone.Transport.start();
    setIsPlaying(true);
  };

  const updateProjection = (line: string, lineNumber: number) => {
    if (line.includes('bpm:')) {
      const val = parseInt(line.split(':')[1].trim(), 10);
      setProjection({ type: 'knob', label: 'Tempo', value: val, min: 40, max: 240, lineNumber });
    } else if (line.includes('frequency:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Frequency', value: val, min: 20, max: 2000, lineNumber });
    } else if (line.includes('decay:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Decay', value: val, min: 0.01, max: 2.0, lineNumber });
    } else if (line.includes('type:')) {
      const val = line.split(':')[1].trim().replace(/^["']|["']$/g, '');
      setProjection({ type: 'select', label: 'Instrument Type', value: val, options: ['membrane', 'noise', 'fm', 'mono', 'subtractive'], lineNumber });
    } else if (line.includes('pattern:')) {
      let val = line.split(':')[1].trim();
      const isArray = val.startsWith('[');
      const cleanVal = val.replace(/^["']|["']$/g, '');
      setProjection({ type: 'pattern', label: 'Pattern Editor', value: isArray ? val : cleanVal, isArray, lineNumber });
    } else {
      setProjection(null);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    setScript(value || '');
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([script], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "composition.beat";
    document.body.appendChild(element);
    element.click();
  };

  const handleProjectionValueChange = (newValue: any) => {
    if (!projection || !editorRef.current) return;

    const lines = script.split('\n');
    const line = lines[projection.lineNumber - 1];
    const parts = line.split(':');
    if (parts.length === 2) {
      const indent = parts[0].match(/^\s*/)?.[0] || '';
      const key = parts[0].trim();

      // For patterns that are strings, we need to preserve quotes
      let formattedValue = typeof newValue === 'string' && !projection.isArray ? `"${newValue}"` : newValue;

      lines[projection.lineNumber - 1] = `${indent}${key}: ${formattedValue}`;
      const newScript = lines.join('\n');
      setScript(newScript);
      setProjection({ ...projection, value: newValue });

      // Real-time audio update
      if (isPlaying) {
        if (key === 'bpm') {
          Tone.Transport.bpm.rampTo(newValue, 0.1);
          setBpm(newValue);
        } else if (key === 'frequency' || key === 'decay') {
           // Find which synth this belongs to by looking up
           let currentSynth: string | null = null;
           for (let i = projection.lineNumber - 1; i >= 0; i--) {
             const synthMatch = lines[i].match(/synth\s+(\w+)/);
             if (synthMatch) {
               currentSynth = synthMatch[1];
               break;
             }
           }
           if (currentSynth && synths.current[currentSynth]) {
             const s = synths.current[currentSynth];
             if (key === 'frequency' && s.frequency) s.frequency.value = newValue;
             if (key === 'decay' && s.envelope) s.envelope.decay = newValue;
           }
        } else if (key === 'pattern') {
           // Update Tone.Sequence
           let trackName: string | null = null;
           let sectionName: string | null = null;
           for (let i = projection.lineNumber - 1; i >= 0; i--) {
             const trackMatch = lines[i].match(/track\s+(\w+)/);
             if (trackMatch && !trackName) trackName = trackMatch[1];
             const sectionMatch = lines[i].match(/section\s+(\w+)/);
             if (sectionMatch) {
               sectionName = sectionMatch[1];
               break;
             }
           }
           if (sectionName && trackName) {
              const seq = activeSequences.current.get(`${sectionName}_${trackName}`);
              if (seq) {
                seq.events = Array.isArray(newValue) ? newValue : newValue.split('');
              }
           }
        }
      }
    }
  };

  const handlePresetChange = (name: string) => {
    setScript(PRESETS[name as keyof typeof PRESETS]);
  };

  const handleToggleRecording = async () => {
    if (!recorder.current) return;

    if (isRecording) {
      const recording = await recorder.current.stop();
      const url = URL.createObjectURL(recording);
      const anchor = document.createElement("a");
      anchor.download = "beatscript_session.webm";
      anchor.href = url;
      anchor.click();
      setIsRecording(false);
    } else {
      if (!isPlaying) await handleTogglePlay();
      recorder.current.start();
      setIsRecording(true);
    }
  };

  // Define BeatScript language for Monaco
  useEffect(() => {
    loader.init().then(monaco => {
      monaco.languages.register({ id: 'beatscript' });
      monaco.languages.setMonarchTokensProvider('beatscript', {
        tokenizer: {
          root: [
            [/\/\/.*$/, 'comment'],
            [/\b(composition|synth|section|track|timeline|length|instrument|pattern|bpm|frequency|type|decay)\b/, 'keyword'],
            [/[{}[\],:]/, 'delimiter'],
            [/\d+/, 'number'],
            [/"[^"]*"/, 'string'],
            [/[a-zA-Z_]\w*/, 'identifier'],
          ]
        }
      });

      monaco.editor.defineTheme('beatscript-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'BD93F9', fontStyle: 'bold' },
          { token: 'comment', foreground: '6272A4' },
          { token: 'string', foreground: 'F1FA8C' },
          { token: 'number', foreground: 'BD93F9' },
          { token: 'identifier', foreground: '8BE9FD' },
        ],
        colors: {
          'editor.background': '#0a0a0a',
          'editor.lineHighlightBackground': '#1a1a1a',
        }
      });
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-beatscript-black text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-beatscript-gray border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-beatscript-purple p-2 rounded-lg shadow-lg shadow-purple-500/20">
            <Music size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">BeatScript <span className="text-beatscript-purple italic">v12</span></h1>
            <span className="text-[10px] text-gray-500 font-mono">WEB_CORE_ACTIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Preset Selector */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
             <Sparkles size={14} className="text-beatscript-purple" />
             <select
               onChange={(e) => handlePresetChange(e.target.value)}
               className="bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
             >
                {Object.keys(PRESETS).map(name => (
                  <option key={name} value={name} className="bg-beatscript-gray">{name}</option>
                ))}
             </select>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
            <Activity size={16} className={isPlaying ? "text-green-500 animate-pulse" : "text-gray-600"} />
            <span>Tone.js Engine</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 font-mono bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
            <span className="text-[10px] text-beatscript-purple">BPM</span>
            <span className="min-w-[2ch]">{bpm}</span>
          </div>
          <div className="flex gap-2">
             <button
                onClick={() => {
                  navigator.clipboard.writeText(script);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2.5 rounded-full bg-beatscript-gray hover:bg-gray-800 border border-white/10 transition-colors text-gray-400 hover:text-white"
                title="Copy to clipboard"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
             <button
                onClick={handleDownload}
                className="p-2.5 rounded-full bg-beatscript-gray hover:bg-gray-800 border border-white/10 transition-colors text-gray-400 hover:text-white"
                title="Download .beat file"
              >
                <Download size={18} />
              </button>
             <button
                onClick={handleToggleRecording}
                className={`p-2.5 rounded-full border border-white/10 transition-colors ${
                  isRecording
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
                    : 'bg-beatscript-gray hover:bg-gray-800 text-gray-400 hover:text-white'
                }`}
                title={isRecording ? "Stop Recording" : "Record Session"}
              >
                <Circle size={18} fill={isRecording ? "currentColor" : "none"} />
              </button>
             <button
                onClick={handleTogglePlay}
                className={`flex items-center gap-2 px-8 py-2.5 rounded-full font-bold transition-all shadow-xl ${
                  isPlaying
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                    : 'bg-beatscript-purple hover:bg-purple-600 shadow-purple-500/30'
                }`}
              >
                {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                {isPlaying ? 'STOP' : 'PLAY'}
              </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-16 bg-beatscript-gray border-r border-white/10 flex flex-col items-center py-6 gap-8 shrink-0">
           <BookOpen
              className={`${showTutorial ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowTutorial(!showTutorial)}
           />
           <Cpu className="text-beatscript-purple cursor-pointer transition-colors" size={24} />
           <Settings className="text-gray-500 hover:text-beatscript-purple cursor-pointer transition-colors" size={24} />
           <div className="mt-auto mb-2 text-[10px] font-bold text-gray-600 -rotate-90 origin-center whitespace-nowrap">STUDIO MODE</div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-beatscript-black relative">
          {showTutorial && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm p-12 flex flex-col gap-8 animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center">
                  <h2 className="text-4xl font-black italic tracking-tighter">GETTING <span className="text-beatscript-purple">STARTED</span></h2>
                  <button onClick={() => setShowTutorial(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
               </div>

               <div className="grid grid-cols-2 gap-12">
                  <div className="flex flex-col gap-4 group">
                     <div className="flex justify-between items-center">
                        <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">01. Composition</h3>
                        <button
                          onClick={() => setScript(`composition {\n  title: "My Track",\n  bpm: 120\n}\n`)}
                          className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-beatscript-purple hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          LOAD
                        </button>
                     </div>
                     <p className="text-gray-400 text-sm leading-relaxed">Every script starts with a <span className="text-white font-mono">composition</span> block. This is where you set the global <span className="text-white font-mono">bpm</span> (beats per minute).</p>
                  </div>
                  <div className="flex flex-col gap-4 group">
                     <div className="flex justify-between items-center">
                        <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">02. Synths</h3>
                        <button
                          onClick={() => setScript(script + `synth my_synth {\n  type: "membrane",\n  frequency: 50\n}\n`)}
                          className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-beatscript-purple hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          APPEND
                        </button>
                     </div>
                     <p className="text-gray-400 text-sm leading-relaxed">Define your instruments using <span className="text-white font-mono">synth</span>. Choose a <span className="text-white font-mono">type</span> like membrane, noise, or fm.</p>
                  </div>
                  <div className="flex flex-col gap-4 group">
                     <div className="flex justify-between items-center">
                        <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">03. Sections</h3>
                        <button
                          onClick={() => setScript(script + `section verse {\n  length: 4\n  track kick {\n    instrument: "my_synth",\n    pattern: "1000100010001000"\n  }\n}\n`)}
                          className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-beatscript-purple hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          APPEND
                        </button>
                     </div>
                     <p className="text-gray-400 text-sm leading-relaxed">Organize your music into <span className="text-white font-mono">section</span>s. Each section has a <span className="text-white font-mono">length</span> and contains multiple <span className="text-white font-mono">track</span>s.</p>
                  </div>
                  <div className="flex flex-col gap-4 group">
                     <div className="flex justify-between items-center">
                        <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">04. Timeline</h3>
                        <button
                          onClick={() => setScript(script + `timeline: ["verse"]\n`)}
                          className="text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-beatscript-purple hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          APPEND
                        </button>
                     </div>
                     <p className="text-gray-400 text-sm leading-relaxed">Finally, the <span className="text-white font-mono">timeline</span> tells the engine which sections to play and in what order.</p>
                  </div>
               </div>

               <div className="mt-auto bg-beatscript-purple/10 border border-beatscript-purple/20 p-6 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <p className="font-bold">Ready to drop the beat?</p>
                     <p className="text-xs text-gray-500 italic">Try clicking on a 'bpm' or 'frequency' line to see the Projection interface.</p>
                  </div>
                  <button
                    onClick={() => setShowTutorial(false)}
                    className="bg-beatscript-purple px-8 py-3 rounded-full font-black text-sm hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20"
                  >
                    START CODING
                  </button>
               </div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 text-xs font-mono text-gray-400 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-beatscript-purple" />
              <span>main.beat</span>
            </div>
            <div className="flex gap-4">
              <span>Ln {cursorPos.lineNumber}, Col {cursorPos.column}</span>
              <span>UTF-8</span>
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="beatscript"
              theme="beatscript-theme"
              value={script}
              onChange={handleEditorChange}
              onMount={(editor) => {
                editorRef.current = editor;
                editor.onDidChangeCursorPosition((e) => {
                  setCursorPos({ lineNumber: e.position.lineNumber, column: e.position.column });
                  const line = editor.getModel()?.getLineContent(e.position.lineNumber) || '';
                  updateProjection(line, e.position.lineNumber);
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                padding: { top: 20 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on'
              }}
            />
          </div>
        </div>

        {/* Projection Area */}
        <div className="w-[400px] bg-beatscript-gray flex flex-col border-l border-white/10 shrink-0">
          <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                Projection
              </h2>
              <p className="text-[10px] text-gray-600 font-medium">REAL-TIME PARAMETER MAPPING</p>
            </div>

            {projection ? (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-black/40 rounded-2xl border border-white/5 p-6 flex flex-col gap-6 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-300">{projection.label}</span>
                    <span className="text-xs font-mono text-beatscript-purple bg-beatscript-purple/10 px-2 py-0.5 rounded">{projection.value}</span>
                  </div>

                  {projection.type === 'knob' && (
                    <div className="flex flex-col gap-4">
                       <input
                         type="range"
                         className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                         min={projection.min}
                         max={projection.max}
                         value={projection.value}
                         onChange={(e) => handleProjectionValueChange(parseFloat(e.target.value))}
                       />
                       <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                         <span>{projection.min}</span>
                         <span>{projection.max}</span>
                       </div>
                    </div>
                  )}

                  {projection.type === 'select' && (
                    <div className="flex flex-wrap gap-2">
                       {projection.options.map((opt: string) => (
                         <button
                           key={opt}
                           onClick={() => handleProjectionValueChange(opt)}
                           className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all ${
                             projection.value === opt
                               ? 'bg-beatscript-purple border-beatscript-purple text-white'
                               : 'bg-black/20 border-white/10 text-gray-500 hover:border-white/20'
                           }`}
                         >
                           {opt}
                         </button>
                       ))}
                    </div>
                  )}

                  {projection.type === 'pattern' && !projection.isArray && (
                    <div className="grid grid-cols-8 gap-2">
                      {projection.value.split('').map((bit: string, i: number) => (
                        <div
                          key={i}
                          onClick={() => {
                            const newPattern = projection.value.split('');
                            newPattern[i] = newPattern[i] === '1' ? '0' : '1';
                            handleProjectionValueChange(newPattern.join(''));
                          }}
                          className={`aspect-square rounded border border-white/5 cursor-pointer transition-all ${
                            bit === '1' ? 'bg-beatscript-purple shadow-[0_0_10px_rgba(189,147,249,0.5)]' : 'bg-gray-800 hover:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {projection.type === 'pattern' && projection.isArray && (
                     <div className="flex flex-col gap-2">
                        <p className="text-[10px] text-gray-500 italic">Melodic pattern editing coming soon...</p>
                        <div className="bg-black/20 p-3 rounded font-mono text-[10px] text-gray-400">
                           {projection.value}
                        </div>
                     </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div className="flex flex-col gap-4 opacity-20">
                  <Activity size={64} className="mx-auto" />
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wider">Awaiting Input</p>
                    <p className="text-[10px]">Select a code block to project its interface.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visualization area */}
          <div className="p-6 border-t border-white/10 bg-black/20">
             <div className="flex items-center justify-between mb-4">
               <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Master Output</span>
               <div className="flex gap-1">
                  <div className={`w-1 h-1 rounded-full ${isPlaying ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-700'}`} />
                  <div className={`w-1 h-1 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-gray-700'}`} />
               </div>
             </div>
             <div className="h-24 flex items-end gap-[2px]">
                {visualizerData.map((val, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-[1px] transition-all duration-75 ${isPlaying ? 'bg-gradient-to-t from-beatscript-purple to-purple-400' : 'bg-gray-800/50'}`}
                    style={{
                      height: `${Math.max(4, val)}%`,
                      opacity: isPlaying ? 0.4 + (val / 150) : 0.2
                    }}
                  />
                ))}
             </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 bg-beatscript-gray border-t border-white/10 text-[9px] text-gray-600 font-bold tracking-widest flex justify-between shrink-0">
        <div className="flex gap-6">
           <span>BEATSCRIPT CORE v12.4.0</span>
           <span className="text-green-900">SYSTEM_READY</span>
        </div>
        <div className="flex gap-6">
          <span className="hover:text-beatscript-purple cursor-pointer transition-colors uppercase">Documentation</span>
          <span className="hover:text-beatscript-purple cursor-pointer transition-colors uppercase">Open Source</span>
          <span className="text-beatscript-purple/80 italic font-medium tracking-normal">Propelled by Gemini Intelligence</span>
        </div>
      </footer>
    </div>
  );
};

export default BeatScriptApp;
