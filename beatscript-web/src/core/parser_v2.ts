import type { BeatScript } from './types';
import { BeatScriptSchema } from './schema';
import { fromZodError } from 'zod-validation-error';

export const generateEuclidean = (k: number, n: number, rotate: number = 0): string => {
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

export interface ParseResult {
  data: BeatScript | null;
  error: string | null;
  warnings: string[];
}

/**
 * High-Performance BeatScript Parser (v12.9)
 * Using block isolation and Zod schema validation.
 */
export const parseBeatScriptEnhanced = (str: string): ParseResult => {
  const result: ParseResult = { data: null, error: null, warnings: [] };
  const cleanStr = str.replace(/\/\/.*$/gm, '');

  try {
    const rawData: any = { bpm: 120, synths: {}, sections: {}, timeline: [] };

    // Composition
    const compMatch = cleanStr.match(/composition\s*\{([^}]*)\}/);
    if (compMatch) {
      const bpmMatch = compMatch[1].match(/bpm:\s*(\d+)/);
      if (bpmMatch) rawData.bpm = parseInt(bpmMatch[1], 10);
    }

    // FX Chains
    const fxMatch = Array.from(cleanStr.matchAll(/fx_chain\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of fxMatch) {
      const chainName = match[1];
      const content = match[2];
      const effects: any[] = [];

      const effMatch = Array.from(content.matchAll(/(\w+)\s*\{([^}]*)\}/g));
      for (const eM of effMatch) {
        const type = eM[1];
        const eContent = eM[2];
        const params: any = {};
        const pList = ['roomSize', 'dampening', 'delayTime', 'feedback', 'wet'];
        pList.forEach(p => {
           const m = eContent.match(new RegExp(`${p}:\\s*(\\d+\\.?\\d*)`));
           if (m) params[p] = parseFloat(m[1]);
        });
        effects.push({ type, ...params });
      }
      rawData.fx_chains = rawData.fx_chains || {};
      rawData.fx_chains[chainName] = effects;
    }

    // Synths
    const synthsMatch = Array.from(cleanStr.matchAll(/synth\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of synthsMatch) {
      const name = match[1];
      const content = match[2];
      const config: any = { type: 'subtractive' };

      const typeM = content.match(/type:\s*["']?(\w+)["']?/);
      if (typeM) config.type = typeM[1];

      const params = ['frequency', 'decay', 'attack', 'sustain', 'release', 'cutoff', 'resonance'];
      params.forEach(p => {
        const m = content.match(new RegExp(`${p}:\\s*(\\d+\\.?\\d*)`));
        if (m) config[p] = parseFloat(m[1]);
      });

      rawData.synths[name] = config;
    }

    // Sections
    const sectionsMatch = Array.from(cleanStr.matchAll(/section\s+(\w+)\s*\{([^}]*)\}/g));
    for (const match of sectionsMatch) {
      const sectionName = match[1];
      const content = match[2];
      const section: any = { length: 4, tracks: {} };

      const lenM = content.match(/length:\s*(\d+)/);
      if (lenM) section.length = parseInt(lenM[1], 10);

      const tracksMatch = Array.from(content.matchAll(/track\s+(\w+)\s*\{([^}]*)\}/g));
      for (const tMatch of tracksMatch) {
        const trackName = tMatch[1];
        const tContent = tMatch[2];
        const track: any = { instrument: 'default' };

        const instM = tContent.match(/instrument:\s*["']?(\w+)["']?/);
        if (instM) track.instrument = instM[1];

        const volM = tContent.match(/volume:\s*(-?\d+)/);
        if (volM) track.volume = parseInt(volM[1], 10);

        const panM = tContent.match(/pan:\s*(-?\d+\.?\d*)/);
        if (panM) track.pan = parseFloat(panM[1]);

        const sendM = tContent.match(/send:\s*\{\s*to:\s*["']?(\w+)["']?,\s*amount:\s*(\d+\.?\d*)\s*\}/);
        if (sendM) track.send = { to: sendM[1], amount: parseFloat(sendM[2]) };

        const patM = tContent.match(/pattern:\s*(euclidean\([^)]*\)|["'][\d]+["']|\[[^\]]*\])/);
        if (patM) {
          const val = patM[1].trim();
          if (val.startsWith('euclidean')) {
            const p = val.match(/\(([^)]*)\)/);
            if (p) {
              const [k, n, r] = p[1].split(',').map(s => parseInt(s.trim()));
              track.pattern = generateEuclidean(k || 0, n || 16, r || 0);
            }
          } else if (val.startsWith('"') || val.startsWith("'")) {
            track.pattern = val.slice(1, -1);
          } else {
            // Complex Array
            const arrayContent = val.slice(1, -1);
            const steps = [];
            let curr = "";
            let d = 0;
            for (let char of arrayContent) {
              if (char === '[') d++;
              if (char === ']') d--;
              if (char === ',' && d === 0) {
                steps.push(curr.trim());
                curr = "";
              } else {
                curr += char;
              }
            }
            steps.push(curr.trim());
            track.pattern = steps.map(s => {
              if (s.startsWith('[') && s.endsWith(']')) {
                return s.slice(1, -1).split(',').map(n => n.trim().replace(/^["']|["']$/g, ''));
              }
              return s.replace(/^["']|["']$/g, '');
            });
          }
        } else {
          track.pattern = "";
        }
        section.tracks[trackName] = track;
      }
      rawData.sections[sectionName] = section;
    }

    // Timeline
    const timelineMatch = cleanStr.match(/timeline:\s*\[([^\]]*)\]/);
    if (timelineMatch) {
      rawData.timeline = timelineMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }

    // Validation
    const validation = BeatScriptSchema.safeParse(rawData);
    if (!validation.success) {
      result.error = fromZodError(validation.error).message;
      return result;
    }

    result.data = validation.data as BeatScript;
  } catch (e: any) {
    result.error = `Parser Exception: ${e.message}`;
  }

  return result;
};
