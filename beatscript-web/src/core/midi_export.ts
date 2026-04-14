import MidiWriter from 'midi-writer-js';
import type { BeatScript } from './types';

/**
 * Converts a BeatScript project to a MIDI file (base64 data URI).
 */
export const exportToMidi = (project: BeatScript): string => {
  const trackObjects: MidiWriter.Track[] = [];

  // Map instrument names to track indices for simplicity
  const instrumentTracks: Record<string, MidiWriter.Track> = {};

  project.timeline.forEach((sectionName) => {
    const section = project.sections[sectionName];
    if (!section) return;

    Object.entries(section.tracks).forEach(([trackName, trackConfig]) => {
      if (!instrumentTracks[trackName]) {
        instrumentTracks[trackName] = new MidiWriter.Track();
        instrumentTracks[trackName].addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));
        instrumentTracks[trackName].setTempo(project.bpm);
      }

      const track = instrumentTracks[trackName];
      const pattern = trackConfig.pattern;

      if (Array.isArray(pattern)) {
        pattern.forEach((step, i) => {
          if (step === '_' || step === '0') {
             // Skip
          } else if (Array.isArray(step)) {
            // Chord
            track.addEvent(new MidiWriter.NoteEvent({
              pitch: step,
              duration: '16',
              startTick: i * 128 // 128 ticks per 16th note in midi-writer-js default
            }));
          } else if (typeof step === 'string' && step !== '1') {
            // Single Note
            track.addEvent(new MidiWriter.NoteEvent({
              pitch: [step],
              duration: '16',
              startTick: i * 128
            }));
          } else if (step === '1') {
            // Generic hit, use C2
            track.addEvent(new MidiWriter.NoteEvent({
              pitch: ['C2'],
              duration: '16',
              startTick: i * 128
            }));
          }
        });
      } else if (typeof pattern === 'string') {
        pattern.split('').forEach((bit, i) => {
          if (bit === '1') {
            track.addEvent(new MidiWriter.NoteEvent({
              pitch: ['C2'],
              duration: '16',
              startTick: i * 128
            }));
          }
        });
      }
    });
  });

  const write = new MidiWriter.Writer(Object.values(instrumentTracks));
  return write.dataUri();
};
