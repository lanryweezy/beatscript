import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import MidiWriter from 'midi-writer-js';
import Editor, { loader } from '@monaco-editor/react';
import { Play, Square, Music, Cpu, Zap, Activity, Download, Settings, BookOpen, Check, Sparkles, Circle, Share2, Palette, Volume2, VolumeX, Save, FolderOpen, Trash2, Plus, ChevronLeft, ChevronRight, Dice5, Sliders } from 'lucide-react';

// --- Types ---
interface BeatScript {
  bpm: number;
  sections: Record<string, Section>;
  synths: Record<string, SynthConfig>;
  fxChains: Record<string, FXChainConfig>;
  timeline: string[];
}

interface FXChainConfig {
  nodes: { type: string, params: any }[];
}

interface SynthConfig {
  type: string;
  frequency?: number;
  decay?: number;
}

interface Section {
  length: number;
  tracks: Record<string, Track>;
}

interface Track {
  instrument: string;
  pattern: string | string[];
  volume?: number;
  pan?: number;
  send?: { to: string, amount: number };
}

// --- Presets ---
const PRESETS = {
  "Lo-Fi Hip Hop": `composition {
  title: "Lo-Fi Morning",
  bpm: 88
}

synth keys {
  type: "fm",
  frequency: 220,
  decay: 1.2
}

synth drums { type: "noise", decay: 0.05 }

section groove {
  length: 4
  track electric_piano {
    instrument: "keys",
    pattern: ["C3", "Eb3", "G3", "Bb3", "D4", "F4", "G4", "_"]
  }
  track beats {
    instrument: "drums",
    pattern: "1000001010000010"
  }
}

timeline: ["groove"]`,
  "Acid House": `composition {
  title: "Acid House",
  bpm: 124
}

synth 303 {
  type: "mono",
  frequency: 100,
  decay: 0.2
}

synth kick { type: "membrane" }

section main {
  length: 4
  track bass {
    instrument: "303",
    pattern: ["C2", "C2", "C3", "C2", "_", "Eb2", "F2", "G2"]
  }
  track bd {
    instrument: "kick",
    pattern: "1000100010001000"
  }
}

timeline: ["main"]`,
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
    pattern: [["C3", "Eb3", "G3"], ["Eb3", "G3", "Bb3"], ["G3", "Bb3", "D4"], ["Bb3", "D4", "F4"]]
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
  track bd { instrument: "kick", pattern: euclidean(4, 16) }
  track cp { instrument: "clap", pattern: euclidean(2, 16, 4) }
  track bs { instrument: "bass", pattern: euclidean(5, 16) }
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

const THEMES = {
  "Default": {
    bg: "#0a0a0a",
    sidebar: "#111111",
    accent: "#8b5cf6", // beatscript-purple
    text: "#ffffff",
    monaco: "beatscript-theme"
  },
  "Dracula": {
    bg: "#282a36",
    sidebar: "#44475a",
    accent: "#bd93f9",
    text: "#f8f8f2",
    monaco: "dracula"
  },
  "Nord": {
    bg: "#2e3440",
    sidebar: "#3b4252",
    accent: "#88c0d0",
    text: "#eceff4",
    monaco: "nord"
  },
  "Solarized": {
    bg: "#002b36",
    sidebar: "#073642",
    accent: "#268bd2",
    text: "#839496",
    monaco: "solarized-dark"
  }
};

const BeatScriptApp: React.FC = () => {
  const [script, setScript] = useState(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        return atob(hash);
      } catch (e) {
        return DEFAULT_SCRIPT;
      }
    }
    return DEFAULT_SCRIPT;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(95);
  const [masterVolume, setMasterVolume] = useState(0); // in dB
  const [isMuted, setIsMuted] = useState(false);
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 });
  const [projection, setProjection] = useState<any>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(32).fill(0));
  const [visualizerMode, setVisualizerMode] = useState<'waveform' | 'fft'>('waveform');
  const [copied, setCopied] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showDocs, setShowDocs] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const [soloedTracks, setSoloedTracks] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProjectionCollapsed, setIsProjectionCollapsed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [midiActivity, setMidiActivity] = useState(false);
  const [isSamplesLoaded, setIsSamplesLoaded] = useState(false);
  const [projects, setProjects] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('beatscript_projects');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [theme, setTheme] = useState<keyof typeof THEMES>("Default");
  const [consoleLogs, setConsoleLogs] = useState<{msg: string, type: 'info' | 'error'}[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [activeTracks, setActiveTracks] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(-1);
  const editorRef = useRef<any>(null);

  // Audio nodes
  const synths = useRef<Record<string, any>>({});
  const fxChains = useRef<Record<string, Tone.ToneAudioNode>>({});
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const analyser = useRef<Tone.Analyser | null>(null);
  const recorder = useRef<Tone.Recorder | null>(null);
  const reverb = useRef<Tone.Reverb | null>(null);
  const delay = useRef<Tone.FeedbackDelay | null>(null);
  const filter = useRef<Tone.Filter | null>(null);
  const distortion = useRef<Tone.Distortion | null>(null);
  const limiter = useRef<Tone.Limiter | null>(null);
  const compressor = useRef<Tone.Compressor | null>(null);
  const activeSequences = useRef<Map<string, Tone.Sequence>>(new Map());

  useEffect(() => {
    // Setup Tone.js
    analyser.current = new Tone.Analyser('waveform', 32);
    recorder.current = new Tone.Recorder();

    reverb.current = new Tone.Reverb({ decay: 1.5, wet: 0 });
    delay.current = new Tone.FeedbackDelay("8n", 0);
    filter.current = new Tone.Filter(20000, "lowpass");
    distortion.current = new Tone.Distortion(0);
    limiter.current = new Tone.Limiter(-0.1); // Prevent digital clipping
    compressor.current = new Tone.Compressor({
      threshold: -12,
      ratio: 4,
      attack: 0.003,
      release: 0.25
    });

    // Chain: Distortion -> Filter -> Delay -> Reverb -> Compressor -> Limiter -> Destination
    distortion.current.chain(filter.current, delay.current, reverb.current, compressor.current, limiter.current, Tone.Destination);
    Tone.Destination.connect(recorder.current);

    // MIDI Support
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((access) => {
        access.inputs.forEach((input) => {
          input.onmidimessage = (event) => {
            const [status, note, velocity] = event.data;
            if (status === 144 && velocity > 0) { // Note On
              setMidiActivity(true);
              setTimeout(() => setMidiActivity(false), 100);
              const noteName = Tone.Frequency(note, "midi").toNote();
              if (synths.current["melody_synth"]) {
                 synths.current["melody_synth"].triggerAttack(noteName);
              }
            } else if (status === 128 || (status === 144 && velocity === 0)) { // Note Off
              const noteName = Tone.Frequency(note, "midi").toNote();
              if (synths.current["melody_synth"]) {
                 synths.current["melody_synth"].triggerRelease(noteName);
              }
            }
          };
        });
      });
    }

    const sampleBase = "https://tonejs.github.io/audio/drum-samples/";
    const sampler = new Tone.Sampler({
      urls: {
        "C1": "CR78/kick.mp3",
        "D1": "CR78/snare.mp3",
        "E1": "CR78/hihat.mp3",
        "F1": "HandClap.mp3"
      },
      baseUrl: sampleBase,
      onload: () => setIsSamplesLoaded(true)
    }).connect(analyser.current!).toDestination();
    samplerRef.current = sampler;

    // Initial synths will be populated on Play from script
    synths.current = {};

    const interval = setInterval(() => {
      if (analyser.current && isPlaying) {
        analyser.current.type = visualizerMode;
        const values = analyser.current.getValue() as Float32Array;
        const normalized = Array.from(values).map(v => {
          if (visualizerMode === 'fft') {
             return Math.max(0, (v + 100) / 100 * 100);
          }
          return Math.abs(v) * 100;
        });
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

  const generateEuclidean = (k: number, n: number, rotate: number = 0): string => {
    let pattern = [];
    for (let i = 0; i < n; i++) {
      pattern.push(Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) ? "1" : "0");
    }
    for (let i = 0; i < rotate; i++) {
      const last = pattern.pop();
      if (last !== undefined) pattern.unshift(last);
    }
    return pattern.join("");
  };

  // Robust-ish parser
  const parseBeatScript = (str: string): BeatScript => {
    // Normalize whitespace for easier regex matching
    str = str.replace(/\s+/g, ' ');
    const res: BeatScript = { bpm: 120, sections: {}, synths: {}, fxChains: {}, timeline: [] };

    // Remove comments
    const cleanStr = str.replace(/\/\/.*$/gm, '');

    // Parse composition
    const compMatch = cleanStr.match(/composition\s*\{([^}]*)\}/);
    if (compMatch) {
      const bpmMatch = compMatch[1].match(/bpm:\s*(\d+)/);
      if (bpmMatch) res.bpm = parseInt(bpmMatch[1], 10);
    }

    // Parse FX Chains
    const fxMatch = Array.from(cleanStr.matchAll(/fx_chain\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of fxMatch) {
       const chainName = match[1];
       const content = match[2];
       const nodes: any[] = [];

       const nodeMatches = Array.from(content.matchAll(/(\w+)\s*\{([^}]*)\}/g));
       for (const nm of nodeMatches) {
          const type = nm[1];
          const paramContent = nm[2];
          const params: any = {};
          paramContent.split(',').forEach(p => {
             const [k, v] = p.split(':').map(s => s.trim());
             if (k && v) params[k] = parseFloat(v) || v.replace(/^["']|["']$/g, '');
          });
          nodes.push({ type, params });
       }
       res.fxChains[chainName] = { nodes };
    }

    // Parse synths
    const synthsMatch = Array.from(cleanStr.matchAll(/synth\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of synthsMatch) {
      const synthName = match[1];
      const synthContent = match[2];
      const config: any = { type: 'membrane' };

      const typeMatch = synthContent.match(/type:\s*["']?(\w+)["']?/);
      if (typeMatch) config.type = typeMatch[1];

      const freqMatch = synthContent.match(/frequency:\s*(\d+\.?\d*)/);
      if (freqMatch) config.frequency = parseFloat(freqMatch[1]);

      const decayMatch = synthContent.match(/decay:\s*(\d+\.?\d*)/);
      if (decayMatch) config.decay = parseFloat(decayMatch[1]);

      res.synths[synthName] = config;
    }

    // Parse sections
    const sectionsMatch = Array.from(cleanStr.matchAll(/section\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of sectionsMatch) {
      const sectionName = match[1];
      const sectionContent = match[2];
      const section: Section = { length: 4, tracks: {} };

      const lenMatch = sectionContent.match(/length:\s*(\d+)/);
      if (lenMatch) section.length = parseInt(lenMatch[1], 10);

      const tracksMatch = Array.from(sectionContent.matchAll(/track\s+(\w+)\s*\{([^}]*)\}/g));
      for (const tMatch of tracksMatch) {
        const trackName = tMatch[1];
        const trackContent = tMatch[2];
        const track: Track = { instrument: '', pattern: '' };

        const instMatch = trackContent.match(/instrument:\s*["']?(\w+)["']?/);
        if (instMatch) track.instrument = instMatch[1];

        const volMatch = trackContent.match(/volume:\s*(-?\d+)/);
        if (volMatch) track.volume = parseInt(volMatch[1], 10);

        const panMatch = trackContent.match(/pan:\s*(-?\d+\.?\d*)/);
        if (panMatch) track.pan = parseFloat(panMatch[1]);

        const sendMatch = trackContent.match(/send:\s*\{\s*to:\s*["']?(\w+)["']?,\s*amount:\s*(\d+\.?\d*)\s*\}/);
        if (sendMatch) track.send = { to: sendMatch[1], amount: parseFloat(sendMatch[2]) };

        const patMatch = trackContent.match(/pattern:\s*(euclidean\([^)]*\)|["'][\d]+["']|\[[^\]]*\])/);
        if (patMatch) {
          const val = patMatch[1].trim();
          if (val.startsWith('euclidean')) {
            const params = val.match(/\(([^)]*)\)/);
            if (params) {
              const [k, n, r] = params[1].split(',').map(s => parseInt(s.trim(), 10));
              track.pattern = generateEuclidean(k || 0, n || 16, r || 0);
            }
          } else if (val.startsWith('"') || val.startsWith("'")) {
            track.pattern = val.slice(1, -1);
          } else {
            try {
              // Handle identifiers/chords in array like [C3, _, Eb3] or [[C3, E3, G3], [F3, A3, C4]]
              const arrayContent = val.slice(1, -1);
              // Simple nested array support: [[A,B], [C,D]] -> ["A,B", "C,D"]
              const steps = [];
              let currentStep = "";
              let depth = 0;
              for (let char of arrayContent) {
                if (char === '[') depth++;
                if (char === ']') depth--;
                if (char === ',' && depth === 0) {
                  steps.push(currentStep.trim());
                  currentStep = "";
                } else {
                  currentStep += char;
                }
              }
              steps.push(currentStep.trim());

              track.pattern = steps.map(s => {
                if (s.startsWith('[') && s.endsWith(']')) {
                  return s.slice(1, -1).split(',').map(n => n.trim().replace(/^["']|["']$/g, ''));
                }
                return s.replace(/^["']|["']$/g, '');
              });
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
      Object.values(synths.current).forEach(s => s.dispose());
      synths.current = {};
      Object.values(fxChains.current).forEach(n => n.dispose());
      fxChains.current = {};
      setIsPlaying(false);
      return;
    }

    await Tone.start();

    // Clear old markers
    if (editorRef.current) {
      const monaco = (window as any).monaco;
      if (monaco) {
         monaco.editor.setModelMarkers(editorRef.current.getModel(), 'beatscript', []);
      }
    }

    let beat;
    try {
      beat = parseBeatScript(script);
      setConsoleLogs(prev => [{msg: `Parsed composition: ${beat.timeline.length} sections`, type: 'info'}, ...prev.slice(0, 50)]);
    } catch (e: any) {
      setConsoleLogs(prev => [{msg: `Parse Error: ${e.message}`, type: 'error'}, ...prev.slice(0, 50)]);
      setShowConsole(true);
      return;
    }
    setBpm(beat.bpm);
    Tone.Transport.bpm.value = beat.bpm;

    if (beat.timeline.length === 0) return;

    // Dispose old synths if any
    Object.values(synths.current).forEach(s => s.dispose());
    synths.current = {};

    // Initialize FX Chains
    Object.entries(beat.fxChains).forEach(([name, config]: [string, any]) => {
       const nodes = config.nodes.map((n: any) => {
          if (n.type === 'reverb') return new Tone.Reverb(n.params);
          if (n.type === 'delay') return new Tone.FeedbackDelay(n.params);
          if (n.type === 'distortion') return new Tone.Distortion(n.params);
          return new Tone.Filter(n.params);
       });
       if (nodes.length > 0) {
          nodes.forEach((n, i) => {
             if (i < nodes.length - 1) n.connect(nodes[i+1]);
             else n.connect(analyser.current!).connect(distortion.current!).toDestination();
          });
          fxChains.current[name] = nodes[0];
       }
    });

    // Initialize Synths from Script
    Object.entries(beat.synths).forEach(([name, config]: [string, any]) => {
      let synth: any;
      const destination = analyser.current;
      if (!destination) return;

      switch (config.type) {
        case 'membrane':
        case 'kick':
          synth = new Tone.MembraneSynth().connect(destination).connect(distortion.current!).toDestination();
          break;
        case 'noise':
        case 'snare':
        case 'hihat':
          synth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { decay: config.decay || 0.1 }
          }).connect(destination).connect(distortion.current!).toDestination();
          break;
        case 'fm':
          synth = new Tone.PolySynth(Tone.FMSynth).connect(destination).connect(distortion.current!).toDestination();
          break;
        case 'mono':
          synth = new Tone.PolySynth(Tone.MonoSynth).connect(destination).connect(distortion.current!).toDestination();
          break;
        case 'physical_model':
        case 'pluck':
          synth = new Tone.PluckSynth().connect(destination).connect(distortion.current!).toDestination();
          break;
        default:
          synth = new Tone.PolySynth(Tone.Synth).connect(destination).connect(distortion.current!).toDestination();
      }

      if (config.decay && (synth as any).envelope) {
         (synth as any).envelope.decay = config.decay;
      }

      synths.current[name] = synth;
    });

    // Build loops for each section/track
    beat.timeline.forEach((sectionName, sectionIndex) => {
      const section = (beat.sections as any)[sectionName];
      if (!section) return;

      Object.entries(section.tracks).forEach(([trackName, track]: [string, any]) => {
        const baseSynth = synths.current[track.instrument];
        if (!baseSynth) return;

        // Create per-track channel for mixing
        const volumeNode = new Tone.Volume(track.volume || 0).connect(analyser.current!);
        const pannerNode = new Tone.Panner(track.pan || 0).connect(volumeNode);

        if (track.send && fxChains.current[track.send.to]) {
           const sendNode = new Tone.Gain(track.send.amount).connect(fxChains.current[track.send.to]);
           volumeNode.connect(sendNode);
        }

        baseSynth.connect(pannerNode);

        const pattern = Array.isArray(track.pattern) ? track.pattern : track.pattern.split('');

        const synthConfig = beat.synths[track.instrument] || { type: 'synth' };

        let stepCount = 0;
        const seq = new Tone.Sequence((time, noteOrBit) => {
          const index = stepCount % pattern.length;
          stepCount++;

          // Solo/Mute logic
          const trackId = `${sectionName}_${trackName}`;
          const isMuted = mutedTracks.has(trackId);
          const isSoloed = soloedTracks.has(trackId);
          const anySoloed = soloedTracks.size > 0;

          if (isMuted || (anySoloed && !isSoloed)) return;

          try {
            Tone.Draw.schedule(() => {
              setActiveTracks(prev => {
                const next = new Set(prev);
                next.add(`${sectionName}_${trackName}`);
                return next;
              });
              setCurrentStep(index % 16); // Assuming 16 steps for visualization
              setTimeout(() => {
                setActiveTracks(prev => {
                  const next = new Set(prev);
                  next.delete(`${sectionName}_${trackName}`);
                  return next;
                });
              }, 100);
            }, time);

            if (noteOrBit === '1') {
              if (synthConfig.type === 'noise' || synthConfig.type === 'snare' || synthConfig.type === 'hihat') {
                baseSynth.triggerAttackRelease("16n", time);
              } else if (synthConfig.type === 'membrane' || synthConfig.type === 'kick') {
                baseSynth.triggerAttackRelease("C1", "16n", time);
              } else {
                baseSynth.triggerAttackRelease("C2", "16n", time);
              }
            } else if (Array.isArray(noteOrBit)) {
              baseSynth.triggerAttackRelease(noteOrBit, "16n", time);
            } else if (noteOrBit !== '0' && noteOrBit !== '_') {
              baseSynth.triggerAttackRelease(noteOrBit, "16n", time);
            }
          } catch (e) {
            console.error(`Playback error on track ${trackName}:`, e);
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
    if (line.includes('title:')) {
       setProjection({ type: 'master_fx', label: 'Master Output FX' });
    } else if (line.includes('bpm:')) {
      const val = parseInt(line.split(':')[1].trim(), 10);
      setProjection({ type: 'knob', label: 'Tempo', value: val, min: 40, max: 240, lineNumber });
    } else if (line.includes('frequency:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Frequency', value: val, min: 20, max: 2000, lineNumber });
    } else if (line.includes('attack:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Attack', value: val, min: 0, max: 2.0, lineNumber });
    } else if (line.includes('decay:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Decay', value: val, min: 0.01, max: 4.0, lineNumber });
    } else if (line.includes('sustain:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Sustain', value: val, min: 0, max: 1.0, lineNumber });
    } else if (line.includes('oscillator:')) {
      const val = line.split(':')[1].trim().replace(/^["']|["']$/g, '');
      setProjection({ type: 'select', label: 'Oscillator', value: val, options: ['sine', 'square', 'sawtooth', 'triangle', 'fatsawtooth', 'pulse'], lineNumber });
    } else if (line.includes('type:')) {
      const val = line.split(':')[1].trim().replace(/^["']|["']$/g, '');
      setProjection({ type: 'select', label: 'Instrument Type', value: val, options: ['membrane', 'noise', 'fm', 'mono', 'subtractive', 'physical_model'], lineNumber });
    } else if (line.includes('volume:')) {
      const val = parseInt(line.split(':')[1].trim(), 10);
      setProjection({ type: 'knob', label: 'Track Volume (dB)', value: val, min: -60, max: 12, lineNumber });
    } else if (line.includes('pan:')) {
      const val = parseFloat(line.split(':')[1].trim());
      setProjection({ type: 'knob', label: 'Track Pan', value: val, min: -1.0, max: 1.0, lineNumber });
    } else if (line.includes('pattern:')) {
      let val = line.split(':')[1].trim();
      if (val.startsWith('euclidean')) {
         const params = val.match(/\(([^)]*)\)/);
         if (params) {
            const [k, n, r] = params[1].split(',').map(s => parseInt(s.trim(), 10));
            setProjection({ type: 'euclidean', label: 'Euclidean Generator', k: k||0, n: n||16, rotate: r||0, lineNumber });
         }
      } else {
         const isArray = val.startsWith('[');
         const cleanVal = val.replace(/^["']|["']$/g, '');
         setProjection({ type: 'pattern', label: 'Pattern Editor', value: isArray ? val : cleanVal, isArray, lineNumber });
      }
    } else {
      setProjection(null);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    const newScript = value || '';
    setScript(newScript);
    window.history.replaceState(null, '', `#${btoa(newScript)}`);
  };

  const handleVolumeChange = (val: number) => {
    setMasterVolume(val);
    Tone.Destination.volume.value = val;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    Tone.Destination.mute = !isMuted;
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([script], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "composition.beat";
    document.body.appendChild(element);
    element.click();
  };

  const handleMidiExport = () => {
    const beat = parseBeatScript(script);
    const track = new MidiWriter.Track();
    track.setTempo(beat.bpm);

    beat.timeline.forEach(sectionName => {
      const section = beat.sections[sectionName];
      if (!section) return;

      Object.values(section.tracks).forEach(t => {
        if (Array.isArray(t.pattern)) {
          t.pattern.forEach(note => {
            if (note !== '_') {
              track.addEvent(new MidiWriter.NoteEvent({pitch: [note], duration: '16'}));
            } else {
              track.addEvent(new MidiWriter.WaitEvent({duration: '16'}));
            }
          });
        }
      });
    });

    const write = new MidiWriter.Writer(track);
    const element = document.createElement("a");
    element.href = write.dataUri();
    element.download = "composition.mid";
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
      window.history.replaceState(null, '', `#${btoa(newScript)}`);
      setProjection({ ...projection, value: newValue });

      // Real-time audio update
      if (isPlaying) {
        if (key === 'bpm') {
          Tone.Transport.bpm.rampTo(newValue, 0.1);
          setBpm(newValue);
        } else if (key === 'frequency' || key === 'attack' || key === 'decay' || key === 'sustain' || key === 'oscillator') {
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
             if (key === 'attack' && s.envelope) s.envelope.attack = newValue;
             if (key === 'decay' && s.envelope) s.envelope.decay = newValue;
             if (key === 'sustain' && s.envelope) s.envelope.sustain = newValue;
             if (key === 'oscillator' && s.oscillator) s.oscillator.type = newValue;
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
    const newScript = PRESETS[name as keyof typeof PRESETS];
    setScript(newScript);
    setCurrentProjectName(null);
    window.history.replaceState(null, '', `#${btoa(newScript)}`);
  };

  const saveProject = (name: string) => {
     const updated = { ...projects, [name]: script };
     setProjects(updated);
     localStorage.setItem('beatscript_projects', JSON.stringify(updated));
     setCurrentProjectName(name);
  };

  const loadProject = (name: string) => {
     const projectScript = projects[name];
     if (projectScript) {
        setScript(projectScript);
        setCurrentProjectName(name);
        window.history.replaceState(null, '', `#${btoa(projectScript)}`);
        setShowLibrary(false);
     }
  };

  const deleteProject = (name: string) => {
     const updated = { ...projects };
     delete updated[name];
     setProjects(updated);
     localStorage.setItem('beatscript_projects', JSON.stringify(updated));
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
  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        handleTogglePlay();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const name = currentProjectName || prompt("Save as?");
        if (name) saveProject(name);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentProjectName, script]);

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

      monaco.editor.defineTheme('dracula', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: 'ff79c6' },
          { token: 'string', foreground: 'f1fa8c' },
          { token: 'number', foreground: 'bd93f9' },
        ],
        colors: { 'editor.background': '#282a36' }
      });

      monaco.editor.defineTheme('nord', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '81a1c1' },
          { token: 'string', foreground: 'a3be8c' },
          { token: 'number', foreground: 'b48ead' },
        ],
        colors: { 'editor.background': '#2e3440' }
      });

      monaco.editor.defineTheme('solarized-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '268bd2' },
          { token: 'string', foreground: '859900' },
          { token: 'number', foreground: 'd33682' },
        ],
        colors: { 'editor.background': '#002b36' }
      });
    });
  }, []);

  const currentTheme = THEMES[theme];

  return (
    <div
      className="flex flex-col h-screen w-screen font-sans overflow-hidden"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
    >
      {/* Header */}
      <header
        className="flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 shrink-0 gap-4"
        style={{ backgroundColor: currentTheme.sidebar }}
      >
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="bg-beatscript-purple p-2 rounded-lg shadow-lg shadow-purple-500/20">
              <Music size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">BeatScript <span className="text-beatscript-purple italic">v12</span></h1>
              <span className="text-[10px] text-gray-500 font-mono">WEB_CORE_ACTIVE</span>
            </div>
          </div>
          <button className="md:hidden p-2 text-gray-400 hover:text-white" onClick={() => setShowDocs(!showDocs)}>
             <BookOpen size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
          {/* Preset Selector */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5 flex-1 md:flex-none">
             <Sparkles size={14} className="text-beatscript-purple shrink-0" />
             <select
               onChange={(e) => handlePresetChange(e.target.value)}
               className="bg-transparent text-[10px] md:text-xs font-bold uppercase tracking-wider focus:outline-none cursor-pointer w-full"
             >
                {Object.keys(PRESETS).map(name => (
                  <option key={name} value={name} className="bg-beatscript-gray">{name}</option>
                ))}
             </select>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-400">
            <Activity size={16} className={isPlaying ? "text-green-500 animate-pulse" : "text-gray-600"} />
            <span>{isSamplesLoaded ? 'Tone.js Engine' : 'Loading Samples...'}</span>
          </div>
          <div className="flex items-center gap-4 bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
            <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
              <span className="text-[10px] text-beatscript-purple font-bold">BPM</span>
              <span className="min-w-[2ch]">{bpm}</span>
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
               <button onClick={toggleMute} className="text-gray-500 hover:text-white transition-colors">
                  {isMuted ? <VolumeX size={14} className="text-red-500" /> : <Volume2 size={14} />}
               </button>
               <input
                 type="range"
                 min="-60" max="0" step="1"
                 value={masterVolume}
                 onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                 className="w-16 h-1 accent-beatscript-purple bg-gray-800 rounded-lg appearance-none cursor-pointer"
               />
            </div>
          </div>
          <div className="flex gap-1 md:gap-2">
             <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
                <Palette size={14} style={{ color: currentTheme.accent }} />
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-transparent text-[10px] md:text-xs font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                    {Object.keys(THEMES).map(t => (
                      <option key={t} value={t} style={{ backgroundColor: currentTheme.sidebar }}>{t}</option>
                    ))}
                </select>
             </div>
             <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2.5 rounded-full bg-beatscript-gray hover:bg-gray-800 border border-white/10 transition-colors text-gray-400 hover:text-white"
                title="Copy share link"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Share2 size={18} />}
              </button>
             <button
                onClick={handleDownload}
                className="p-2.5 rounded-full bg-beatscript-gray hover:bg-gray-800 border border-white/10 transition-colors text-gray-400 hover:text-white"
                title="Download .beat file"
              >
                <Download size={18} />
              </button>
             <button
                onClick={handleMidiExport}
                className="p-2.5 rounded-full bg-beatscript-gray hover:bg-gray-800 border border-white/10 transition-colors text-gray-400 hover:text-white"
                title="Export to MIDI"
              >
                <Cpu size={18} />
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
        <div
          className={`hidden md:flex border-r border-white/10 flex-col items-center py-6 gap-8 shrink-0 transition-all duration-300 relative ${isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-16'}`}
          style={{ backgroundColor: currentTheme.sidebar }}
        >
           <button
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-beatscript-gray border border-white/10 flex items-center justify-center z-10 hover:bg-gray-800 transition-colors ${isSidebarCollapsed ? 'translate-x-3' : ''}`}
           >
              {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
           </button>
           <FolderOpen
              className={`${showLibrary ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowLibrary(!showLibrary)}
           />
           <BookOpen
              className={`${showDocs ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowDocs(!showDocs)}
           />
           <Zap
              className={`${showTutorial ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowTutorial(!showTutorial)}
           />
           <Cpu className="text-beatscript-purple cursor-pointer transition-colors" size={24} />
           <Settings
              className={`${showSettings ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowSettings(!showSettings)}
           />
           <Sliders
              className={`${showMixer ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowMixer(!showMixer)}
           />
           <Activity
              className={`${showConsole ? 'text-beatscript-purple' : 'text-gray-500'} hover:text-beatscript-purple cursor-pointer transition-colors`}
              size={24}
              onClick={() => setShowConsole(!showConsole)}
           />
           <div className="mt-auto mb-2 text-[10px] font-bold text-gray-600 -rotate-90 origin-center whitespace-nowrap">STUDIO MODE</div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-beatscript-black relative">
          {showLibrary && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl p-12 overflow-y-auto animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black italic tracking-tighter">PROJECT <span className="text-beatscript-purple">LIBRARY</span></h2>
                  <button onClick={() => setShowLibrary(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div
                    onClick={() => {
                       const name = prompt("Project Name?");
                       if (name) saveProject(name);
                    }}
                    className="aspect-video rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:border-beatscript-purple/50 hover:bg-white/5 transition-all cursor-pointer group"
                  >
                     <Plus size={32} className="text-gray-600 group-hover:text-beatscript-purple" />
                     <span className="text-xs font-bold uppercase tracking-widest text-gray-500">New Project</span>
                  </div>

                  {Object.entries(projects).map(([name, _]) => (
                     <div key={name} className="aspect-video rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between group hover:border-beatscript-purple/50 transition-all">
                        <div className="flex justify-between items-start">
                           <h3 className="font-bold text-lg truncate pr-4">{name}</h3>
                           <button onClick={() => deleteProject(name)} className="text-gray-600 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                           </button>
                        </div>
                        <button
                           onClick={() => loadProject(name)}
                           className="w-full py-2 rounded-lg bg-beatscript-purple/10 border border-beatscript-purple/20 text-[10px] font-black uppercase tracking-widest hover:bg-beatscript-purple hover:text-white transition-all"
                        >
                           Load Project
                        </button>
                     </div>
                  ))}
               </div>
            </div>
          )}
          {showSettings && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl p-12 overflow-y-auto animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black italic tracking-tighter">STUDIO <span className="text-beatscript-purple">SETTINGS</span></h2>
                  <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
               </div>

               <div className="max-w-2xl mx-auto flex flex-col gap-12">
                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">Sample Manager</h3>
                     <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-6">
                        <Volume2 size={48} className="text-gray-600" />
                        <div className="text-center">
                           <p className="text-lg font-bold">Import Custom Samples</p>
                           <p className="text-sm text-gray-400">Drag and drop audio files to use them as instruments.</p>
                        </div>
                        <input
                           type="file"
                           accept="audio/*"
                           className="hidden"
                           id="sample-upload"
                           onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && samplerRef.current) {
                                 const url = URL.createObjectURL(file);
                                 samplerRef.current.add("F1", url);
                                 alert(`Sample ${file.name} loaded to slot F1 (use instrument 'clap')`);
                              }
                           }}
                        />
                        <label
                           htmlFor="sample-upload"
                           className="px-8 py-3 rounded-full bg-beatscript-purple font-black uppercase tracking-widest text-xs hover:scale-105 transition-all cursor-pointer"
                        >
                           Upload WAV/MP3
                        </label>
                     </div>
                  </section>

                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">MIDI Configuration</h3>
                     <div className="bg-white/5 p-8 rounded-2xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className={`w-3 h-3 rounded-full transition-all duration-75 ${midiActivity ? 'bg-yellow-400 scale-150' : 'bg-green-500'}`} />
                           <span className="font-bold">WebMIDI Status</span>
                        </div>
                        <span className="text-xs font-mono text-gray-400">{midiActivity ? 'RECEIVING DATA...' : 'ACTIVE / LISTENING'}</span>
                     </div>
                  </section>
               </div>
            </div>
          )}
          {showConsole && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl p-12 overflow-y-auto animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black italic tracking-tighter">STUDIO <span className="text-beatscript-purple">CONSOLE</span></h2>
                  <div className="flex gap-4">
                     <button onClick={() => setConsoleLogs([])} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Clear Logs</button>
                     <button onClick={() => setShowConsole(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
                  </div>
               </div>
               <div className="flex flex-col gap-2 font-mono text-sm">
                  {consoleLogs.length === 0 && <p className="text-gray-600 italic">No logs yet. Start playback to see diagnostics.</p>}
                  {consoleLogs.map((log, i) => (
                     <div key={i} className={`p-3 rounded border ${log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log.msg}
                     </div>
                  ))}
               </div>
            </div>
          )}
          {showMixer && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl p-12 overflow-y-auto animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black italic tracking-tighter">STUDIO <span className="text-beatscript-purple">MIXER</span></h2>
                  <button onClick={() => setShowMixer(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
               </div>

               <div className="flex gap-4 overflow-x-auto pb-8 min-h-[400px]">
                  {/* Master Channel */}
                  <div className="w-32 flex flex-col items-center bg-white/5 border border-beatscript-purple/30 rounded-2xl p-4 shrink-0 gap-6">
                     <span className="text-[10px] font-black uppercase text-beatscript-purple tracking-widest">MASTER</span>
                     <div className="flex-1 flex flex-col items-center gap-4">
                        <div className="relative flex-1 flex flex-col items-center">
                           <input
                              type="range"
                              min="-60" max="6" step="1"
                              value={masterVolume}
                              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                              className="h-full w-1.5 accent-beatscript-purple bg-gray-800 rounded-full appearance-none cursor-pointer vertical-slider"
                              style={{ writingMode: 'bt-lr' as any, appearance: 'slider-vertical' as any }}
                           />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">{masterVolume}dB</span>
                     </div>
                     <button
                        onClick={toggleMute}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-500'}`}
                     >
                        <VolumeX size={16} />
                     </button>
                  </div>

                  {/* Track Channels */}
                  {(() => {
                     const beat = parseBeatScript(script);
                     const tracks: [string, string, any][] = []; // [section, track, config]
                     Object.entries(beat.sections).forEach(([sName, s]) => {
                        Object.entries(s.tracks).forEach(([tName, t]) => {
                           tracks.push([sName, tName, t]);
                        });
                     });

                     return tracks.map(([sName, tName, t]) => {
                        const trackId = `${sName}_${tName}`;
                        const isMuted = mutedTracks.has(trackId);
                        const isSoloed = soloedTracks.has(trackId);

                        return (
                           <div key={trackId} className="w-32 flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 gap-4">
                              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest truncate w-full text-center" title={tName}>{tName}</span>
                              <div className="flex-1 flex flex-col items-center gap-4">
                                 <div className="flex flex-col items-center gap-1 w-full">
                                    <span className="text-[8px] text-gray-600 font-bold uppercase">PAN</span>
                                    <input
                                       type="range"
                                       min="-1" max="1" step="0.1"
                                       value={t.pan || 0}
                                       onChange={() => {
                                          // We'll need a way to find this track in the code and update it
                                          // For now, let's just use the projection logic if we can find the line
                                          alert("Mixer live-sync coming in v12.7! Use Projection UI for now.");
                                       }}
                                       className="w-full accent-gray-500 h-1 bg-gray-800 rounded-full appearance-none cursor-pointer"
                                    />
                                 </div>
                                 <div className="relative flex-1 flex flex-col items-center">
                                    <input
                                       type="range"
                                       min="-60" max="12" step="1"
                                       value={t.volume || 0}
                                       onChange={() => {}}
                                       className="h-full w-1.5 accent-beatscript-purple bg-gray-800 rounded-full appearance-none cursor-pointer vertical-slider"
                                       style={{ writingMode: 'bt-lr' as any, appearance: 'slider-vertical' as any }}
                                    />
                                 </div>
                                 <span className="text-[10px] font-mono text-gray-500">{t.volume || 0}dB</span>
                              </div>
                              <div className="flex flex-col gap-2 w-full">
                                 <div className="flex gap-2">
                                    <button
                                       onClick={() => {
                                          const next = new Set(mutedTracks);
                                          if (next.has(trackId)) next.delete(trackId);
                                          else next.add(trackId);
                                          setMutedTracks(next);
                                       }}
                                       className={`flex-1 py-1 rounded text-[10px] font-black transition-all ${isMuted ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-600'}`}
                                    >
                                       MUTE
                                    </button>
                                    <button
                                       onClick={() => {
                                          const next = new Set(soloedTracks);
                                          if (next.has(trackId)) next.delete(trackId);
                                          else next.add(trackId);
                                          setSoloedTracks(next);
                                       }}
                                       className={`flex-1 py-1 rounded text-[10px] font-black transition-all ${isSoloed ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-600'}`}
                                    >
                                       SOLO
                                    </button>
                                 </div>
                                 <div className="h-1.5 w-full bg-gray-900 rounded overflow-hidden">
                                    <div className={`h-full transition-all duration-75 ${activeTracks.has(trackId) ? 'bg-green-500 w-full' : 'bg-transparent w-0'}`} />
                                 </div>
                              </div>
                           </div>
                        );
                     });
                  })()}
               </div>
            </div>
          )}
          {showDocs && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl p-12 overflow-y-auto animate-in fade-in zoom-in duration-300">
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-4xl font-black italic tracking-tighter">LANGUAGE <span className="text-beatscript-purple">REFERENCE</span></h2>
                  <button onClick={() => setShowDocs(false)} className="text-gray-500 hover:text-white transition-colors">CLOSE [X]</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">Base Structure</h3>
                     <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-xs leading-relaxed">
                        <span className="text-purple-400">composition</span> {'{'}<br/>
                        &nbsp;&nbsp;title: <span className="text-yellow-200">"My Track"</span>,<br/>
                        &nbsp;&nbsp;bpm: <span className="text-purple-400">120</span><br/>
                        {'}'}
                     </div>
                     <p className="text-gray-400 text-sm">Every script must define a global composition block for metadata and timing.</p>
                  </section>

                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">Synthesizers</h3>
                     <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-xs leading-relaxed">
                        <span className="text-purple-400">synth</span> lead {'{'}<br/>
                        &nbsp;&nbsp;type: <span className="text-yellow-200">"fm"</span>,<br/>
                        &nbsp;&nbsp;frequency: <span className="text-purple-400">440</span>,<br/>
                        &nbsp;&nbsp;decay: <span className="text-purple-400">0.5</span><br/>
                        {'}'}
                     </div>
                     <p className="text-gray-400 text-sm">Synths define the instruments. Common types: <code className="text-white">membrane</code>, <code className="text-white">noise</code>, <code className="text-white">fm</code>.</p>
                  </section>

                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">Patterns (Rhythmic)</h3>
                     <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-xs leading-relaxed">
                        track drum {'{'}<br/>
                        &nbsp;&nbsp;instrument: <span className="text-yellow-200">"kick_synth"</span>,<br/>
                        &nbsp;&nbsp;pattern: <span className="text-yellow-200">"10001000"</span><br/>
                        {'}'}
                     </div>
                     <p className="text-gray-400 text-sm">Binary strings represent 16th notes. <code className="text-white">1</code> is a trigger, <code className="text-white">0</code> is a rest.</p>
                  </section>

                  <section className="flex flex-col gap-6">
                     <h3 className="text-beatscript-purple font-mono font-bold uppercase tracking-widest text-sm">Patterns (Melodic)</h3>
                     <div className="bg-white/5 p-6 rounded-xl border border-white/10 font-mono text-xs leading-relaxed">
                        track melody {'{'}<br/>
                        &nbsp;&nbsp;instrument: <span className="text-yellow-200">"lead"</span>,<br/>
                        &nbsp;&nbsp;pattern: [<span className="text-yellow-200">"C3"</span>, <span className="text-yellow-200">"_"</span>, <span className="text-yellow-200">"Eb3"</span>]<br/>
                        {'}'}
                     </div>
                     <p className="text-gray-400 text-sm">Arrays of notes. Use <code className="text-white">_</code> for a rest. Octaves follow standard notation (e.g., C4).</p>
                  </section>
               </div>
            </div>
          )}
          {showTutorial && (
            <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md p-12 flex flex-col gap-8 animate-in fade-in duration-300">
               <div className="flex justify-between items-center">
                  <h2 className="text-4xl font-black italic tracking-tighter">STUDIO <span className="text-beatscript-purple">QUICK TOUR</span></h2>
                  <button onClick={() => setShowTutorial(false)} className="text-gray-500 hover:text-white transition-colors">SKIP [X]</button>
               </div>

               <div className="flex-1 flex items-center justify-center">
                  <div className="max-w-2xl w-full flex flex-col gap-8 bg-white/5 p-12 rounded-3xl border border-white/10 shadow-2xl">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-beatscript-purple flex items-center justify-center text-3xl font-black">
                           {tourStep + 1}
                        </div>
                        <div>
                           <h3 className="text-2xl font-black uppercase tracking-tight">
                              {tourStep === 0 && "The Editor"}
                              {tourStep === 1 && "The Projection UI"}
                              {tourStep === 2 && "The Master FX Rack"}
                              {tourStep === 3 && "Share Your Beat"}
                           </h3>
                           <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">
                              Step {tourStep + 1} of 4
                           </p>
                        </div>
                     </div>

                     <p className="text-lg leading-relaxed text-gray-300">
                        {tourStep === 0 && "This is where the magic happens. BeatScript is a declarative language. Define your synths and patterns in code, and watch the engine bring them to life."}
                        {tourStep === 1 && "Code is tactile. Click on any line in the editor (like 'bpm' or 'pattern') to reveal interactive controls in the Projection panel on the right."}
                        {tourStep === 2 && "Click the 'composition' title to access the Master FX rack. Tweak filters, distortion, and reverb to shape your final sound."}
                        {tourStep === 3 && "Every change you make is saved in the URL hash. Copy the link and share it with the world—your beat is instantly playable anywhere."}
                     </p>

                     <div className="flex justify-between items-center mt-4">
                        <div className="flex gap-2">
                           {[0,1,2,3].map(i => (
                              <div key={i} className={`w-2 h-2 rounded-full transition-all ${tourStep === i ? 'bg-beatscript-purple w-6' : 'bg-gray-700'}`} />
                           ))}
                        </div>
                        <div className="flex gap-4">
                           {tourStep > 0 && (
                              <button
                                 onClick={() => setTourStep(tourStep - 1)}
                                 className="px-6 py-2 rounded-full border border-white/10 text-xs font-bold hover:bg-white/5 transition-all"
                              >
                                 BACK
                              </button>
                           )}
                           <button
                              onClick={() => {
                                 if (tourStep < 3) setTourStep(tourStep + 1);
                                 else setShowTutorial(false);
                              }}
                              className="px-8 py-2 rounded-full bg-beatscript-purple text-xs font-black hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
                           >
                              {tourStep < 3 ? "CONTINUE" : "GET COOKING"}
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 text-xs font-mono text-gray-400 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-beatscript-purple" />
              <span>{currentProjectName ? `${currentProjectName}.beat` : 'unsaved_composition.beat'}</span>
              {!currentProjectName && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded ml-2">UNSAVED</span>}
            </div>
            <button
               onClick={() => {
                  const name = currentProjectName || prompt("Save as?");
                  if (name) saveProject(name);
               }}
               className="flex items-center gap-1.5 hover:text-white transition-colors text-[10px] font-bold"
            >
               <Save size={12} />
               <span>SAVE</span>
            </button>
            <div className="flex gap-4">
              <span>Ln {cursorPos.lineNumber}, Col {cursorPos.column}</span>
              <span>UTF-8</span>
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="beatscript"
              theme={currentTheme.monaco}
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
        <div
          className={`hidden xl:flex flex-col border-l border-white/10 shrink-0 transition-all duration-300 relative ${isProjectionCollapsed ? 'w-0 overflow-hidden' : 'w-[400px]'}`}
          style={{ backgroundColor: currentTheme.sidebar }}
        >
           <button
             onClick={() => setIsProjectionCollapsed(!isProjectionCollapsed)}
             className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-beatscript-gray border border-white/10 flex items-center justify-center z-10 hover:bg-gray-800 transition-colors"
           >
              {isProjectionCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
           </button>
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

                  {['Attack', 'Decay', 'Sustain'].includes(projection.label) && (
                     <div className="h-20 w-full bg-black/40 rounded-lg border border-white/5 relative overflow-hidden">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                           <path
                              d="M 0 100 L 10 20 L 40 50 L 80 50 L 100 100"
                              fill="rgba(139, 92, 246, 0.1)"
                              stroke="#8b5cf6"
                              strokeWidth="2"
                           />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                           <Zap size={32} className="text-beatscript-purple" />
                        </div>
                     </div>
                  )}

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
                    <div className="flex flex-col gap-4">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase text-gray-400">Step Sequencer</span>
                          <button
                            onClick={() => {
                               const random = new Array(projection.value.length).fill(0).map(() => Math.random() > 0.7 ? '1' : '0').join('');
                               handleProjectionValueChange(random);
                            }}
                            className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-beatscript-purple transition-all"
                            title="Randomize Pattern"
                          >
                             <Dice5 size={14} />
                          </button>
                       </div>
                    <div className="grid grid-cols-8 gap-2">
                      {projection.value.split('').map((bit: string, i: number) => (
                        <div
                          key={i}
                          onClick={() => {
                            const newPattern = projection.value.split('');
                            newPattern[i] = newPattern[i] === '1' ? '0' : '1';
                            handleProjectionValueChange(newPattern.join(''));
                          }}
                          className={`aspect-square rounded border cursor-pointer transition-all ${
                            bit === '1' ? 'bg-beatscript-purple shadow-[0_0_10px_rgba(189,147,249,0.5)]' : 'bg-gray-800 hover:bg-gray-700'
                          } ${currentStep === i ? 'ring-2 ring-white border-white' : 'border-white/5'}`}
                        />
                      ))}
                    </div>
                    </div>
                  )}
                  {projection.type === 'pattern' && projection.isArray && (
                     <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-2">
                           <span className="text-[10px] font-bold uppercase text-gray-400 w-full mb-1">Chord Helper</span>
                           {['Cmaj', 'Amin', 'Fmaj', 'Gmaj'].map(chord => (
                              <button
                                key={chord}
                                onClick={() => {
                                   const map: Record<string, string[]> = {
                                      'Cmaj': ['C3', 'E3', 'G3'],
                                      'Amin': ['A2', 'C3', 'E3'],
                                      'Fmaj': ['F2', 'A2', 'C3'],
                                      'Gmaj': ['G2', 'B2', 'D3']
                                   };
                                   handleProjectionValueChange(map[chord]);
                                }}
                                className="px-2 py-1 rounded bg-beatscript-purple/20 border border-beatscript-purple/40 text-[10px] hover:bg-beatscript-purple/40 transition-colors"
                              >
                                {chord}
                              </button>
                           ))}
                        </div>
                        <div className="bg-black/20 p-3 rounded font-mono text-[10px] text-gray-400">
                           {Array.isArray(projection.value) ? projection.value.join(', ') : projection.value}
                        </div>
                     </div>
                  )}

                  {projection.type === 'euclidean' && (
                     <div className="flex flex-col gap-8">
                        <div className="flex flex-col gap-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-gray-400">Hits (k)</span>
                              <span className="text-xs font-mono">{projection.k}</span>
                           </div>
                           <input
                             type="range"
                             className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                             min="0" max={projection.n} step="1"
                             value={projection.k}
                             onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setProjection({...projection, k: val});
                                handleProjectionValueChange(`euclidean(${val}, ${projection.n}${projection.rotate ? `, ${projection.rotate}` : ''})`);
                             }}
                           />
                        </div>
                        <div className="flex flex-col gap-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-gray-400">Steps (n)</span>
                              <span className="text-xs font-mono">{projection.n}</span>
                           </div>
                           <input
                             type="range"
                             className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                             min="1" max="32" step="1"
                             value={projection.n}
                             onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setProjection({...projection, n: val});
                                handleProjectionValueChange(`euclidean(${projection.k}, ${val}${projection.rotate ? `, ${projection.rotate}` : ''})`);
                             }}
                           />
                        </div>
                        <div className="flex flex-col gap-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-gray-400">Rotate</span>
                              <span className="text-xs font-mono">{projection.rotate}</span>
                           </div>
                           <input
                             type="range"
                             className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                             min="0" max={projection.n - 1} step="1"
                             value={projection.rotate}
                             onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setProjection({...projection, rotate: val});
                                handleProjectionValueChange(`euclidean(${projection.k}, ${projection.n}, ${val})`);
                             }}
                           />
                        </div>
                     </div>
                  )}

                  {projection.type === 'master_fx' && (
                    <div className="flex flex-col gap-8">
                       <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold uppercase text-gray-400">Low-Pass Filter</span>
                          </div>
                          <input
                            type="range"
                            className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                            min="20" max="20000" step="1"
                            defaultValue="20000"
                            onChange={(e) => { if(filter.current) filter.current.frequency.value = parseFloat(e.target.value) }}
                          />
                       </div>
                       <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold uppercase text-gray-400">Distortion</span>
                          </div>
                          <input
                            type="range"
                            className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                            min="0" max="1" step="0.01"
                            defaultValue="0"
                            onChange={(e) => { if(distortion.current) distortion.current.distortion = parseFloat(e.target.value) }}
                          />
                       </div>
                       <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold uppercase text-gray-400">Reverb Wet</span>
                          </div>
                          <input
                            type="range"
                            className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                            min="0" max="1" step="0.01"
                            defaultValue="0"
                            onChange={(e) => { if(reverb.current) reverb.current.wet.value = parseFloat(e.target.value) }}
                          />
                       </div>
                       <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold uppercase text-gray-400">Delay Feedback</span>
                          </div>
                          <input
                            type="range"
                            className="w-full accent-beatscript-purple h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                            min="0" max="0.9" step="0.01"
                            defaultValue="0"
                            onChange={(e) => { if(delay.current) delay.current.feedback.value = parseFloat(e.target.value) }}
                          />
                       </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-8">
                {isPlaying ? (
                   <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Session Monitor</span>
                      </div>
                      <div className="flex flex-col gap-3">
                         {Array.from(activeTracks).map(trackId => (
                            <div key={trackId} className="flex items-center justify-between bg-beatscript-purple/10 border border-beatscript-purple/20 p-3 rounded-lg">
                               <div className="flex items-center gap-3">
                                  <Volume2 size={14} className="text-beatscript-purple" />
                                  <span className="text-xs font-bold truncate">{trackId.split('_')[1]}</span>
                               </div>
                               <div className="flex gap-1">
                                  {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-beatscript-purple rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
                                </div>
                            </div>
                         ))}
                         {activeTracks.size === 0 && <p className="text-[10px] text-gray-600 italic">Silent steps...</p>}
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
            )}
          </div>

          {/* Visualization area */}
          <div className="p-6 border-t border-white/10 bg-black/20">
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Master Output</span>
                  <button
                    onClick={() => setVisualizerMode(visualizerMode === 'waveform' ? 'fft' : 'waveform')}
                    className="text-[8px] px-1.5 py-0.5 rounded border border-white/5 hover:bg-white/5 text-gray-500 uppercase font-mono"
                  >
                    {visualizerMode}
                  </button>
               </div>
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
      <footer
        className="px-6 py-2 border-t border-white/10 text-[9px] text-gray-600 font-bold tracking-widest flex justify-between shrink-0"
        style={{ backgroundColor: currentTheme.sidebar }}
      >
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
