import { z } from 'zod';

export const SynthSchema = z.object({
  type: z.enum(['membrane', 'noise', 'fm', 'mono', 'pluck', 'subtractive']),
  frequency: z.number().optional(),
  decay: z.number().min(0).max(10).optional(),
  attack: z.number().min(0).max(10).optional(),
  sustain: z.number().min(0).max(1).optional(),
  release: z.number().min(0).max(10).optional(),
  cutoff: z.number().min(20).max(20000).optional(),
  resonance: z.number().min(0).max(20).optional(),
});

export const TrackSchema = z.object({
  instrument: z.string(),
  pattern: z.union([z.string(), z.array(z.union([z.string(), z.array(z.string())]))]),
  volume: z.number().optional(),
  pan: z.number().min(-1).max(1).optional(),
  send: z.object({
    to: z.string(),
    amount: z.number().min(0).max(1)
  }).optional(),
});

export const SectionSchema = z.object({
  length: z.number().int().min(1),
  tracks: z.record(z.string(), TrackSchema),
});

export const BeatScriptSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  bpm: z.number().min(20).max(300),
  synths: z.record(z.string(), SynthSchema),
  sections: z.record(z.string(), SectionSchema),
  timeline: z.array(z.string()),
  fx_chains: z.record(z.string(), z.array(z.any())).optional(),
});
