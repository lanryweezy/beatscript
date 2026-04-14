export interface BeatScript {
  bpm: number;
  sections: Record<string, Section>;
  synths: Record<string, SynthConfig>;
  fx_chains?: Record<string, any[]>;
  timeline: string[];
}

export interface FXChainConfig {
  nodes: { type: string, params: any }[];
}

export interface SynthConfig {
  type: string;
  frequency?: number;
  decay?: number;
  attack?: number;
  sustain?: number;
  release?: number;
}

export interface Section {
  length: number;
  tracks: Record<string, Track>;
}

export interface Track {
  instrument: string;
  pattern: string | (string | string[])[];
  volume?: number;
  pan?: number;
  send?: { to: string, amount: number };
}
