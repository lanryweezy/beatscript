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
 * Finds the content of a balanced block starting after a given keyword.
 * Returns [fullMatch, content, remainingIndex]
 */
const findBalancedBlock = (str: string, startIndex: number): [string, string, number] | null => {
  const openingBraceIdx = str.indexOf('{', startIndex);
  if (openingBraceIdx === -1) return null;

  let depth = 0;
  let blockEnd = -1;

  for (let i = openingBraceIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') depth--;

    if (depth === 0) {
      blockEnd = i;
      break;
    }
  }

  if (blockEnd === -1) return null;

  const fullMatch = str.slice(startIndex, blockEnd + 1);
  const content = str.slice(openingBraceIdx + 1, blockEnd);
  return [fullMatch, content, blockEnd + 1];
};

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
    const compStart = cleanStr.indexOf('composition');
    if (compStart !== -1) {
      const block = findBalancedBlock(cleanStr, compStart);
      if (block) {
        const content = block[1];
        const bpmMatch = content.match(/bpm:\s*(\d+)/);
        if (bpmMatch) rawData.bpm = parseInt(bpmMatch[1], 10);

        const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
        if (titleMatch) rawData.title = titleMatch[1];

        const artistMatch = content.match(/artist:\s*["']([^"']+)["']/);
        if (artistMatch) rawData.artist = artistMatch[1];
      }
    }

    // FX Chains
    let searchIdx = 0;
    while (true) {
      const fxStart = cleanStr.indexOf('fx_chain', searchIdx);
      if (fxStart === -1) break;

      const block = findBalancedBlock(cleanStr, fxStart);
      if (!block) {
        searchIdx = fxStart + 8;
        continue;
      }

      const header = cleanStr.slice(fxStart, cleanStr.indexOf('{', fxStart));
      const chainName = header.replace('fx_chain', '').trim();
      const content = block[1];
      const effects: any[] = [];

      let eIdx = 0;
      while (true) {
        // Find next effect by looking for "word {"
        const eMatch = content.slice(eIdx).match(/(\w+)\s*\{/);
        if (!eMatch) break;

        const relativeEStart = eMatch.index!;
        const eBlock = findBalancedBlock(content, eIdx + relativeEStart);
        if (!eBlock) break;

        const type = eMatch[1];
        const eContent = eBlock[1];
        const params: any = {};
        const pList = ['roomSize', 'dampening', 'delayTime', 'feedback', 'wet'];
        pList.forEach(p => {
           const m = eContent.match(new RegExp(`${p}:\\s*(\\d+\\.?\\d*)`));
           if (m) params[p] = parseFloat(m[1]);
        });
        effects.push({ type, ...params });
        eIdx = content.indexOf(eBlock[0], eIdx + relativeEStart) + eBlock[0].length;
      }

      rawData.fx_chains = rawData.fx_chains || {};
      rawData.fx_chains[chainName] = effects;
      searchIdx = block[2];
    }

    // Synths
    searchIdx = 0;
    while (true) {
      const synthStart = cleanStr.indexOf('synth', searchIdx);
      if (synthStart === -1) break;

      const block = findBalancedBlock(cleanStr, synthStart);
      if (!block) {
        searchIdx = synthStart + 5;
        continue;
      }

      const header = cleanStr.slice(synthStart, cleanStr.indexOf('{', synthStart));
      const name = header.replace('synth', '').trim();
      const content = block[1];
      const config: any = { type: 'subtractive' };

      const typeM = content.match(/type:\s*["']?(\w+)["']?/);
      if (typeM) config.type = typeM[1];

      const params = ['frequency', 'decay', 'attack', 'sustain', 'release', 'cutoff', 'resonance'];
      params.forEach(p => {
        const m = content.match(new RegExp(`${p}:\\s*(\\d+\\.?\\d*)`));
        if (m) config[p] = parseFloat(m[1]);
      });

      rawData.synths[name] = config;
      searchIdx = block[2];
    }

    // Sections
    searchIdx = 0;
    while (true) {
      const sectionStart = cleanStr.indexOf('section', searchIdx);
      if (sectionStart === -1) break;

      const block = findBalancedBlock(cleanStr, sectionStart);
      if (!block) {
        searchIdx = sectionStart + 7;
        continue;
      }

      const header = cleanStr.slice(sectionStart, cleanStr.indexOf('{', sectionStart));
      const sectionName = header.replace('section', '').trim();
      const content = block[1];
      const section: any = { length: 4, tracks: {} };

      const lenM = content.match(/length:\s*(\d+)/);
      if (lenM) section.length = parseInt(lenM[1], 10);

      // Tracks inside section
      let tIdx = 0;
      while (true) {
        const tMatch = content.slice(tIdx).match(/track\s+(\w+)\s*\{/);
        if (!tMatch) break;

        const relativeTStart = tMatch.index!;
        const tBlock = findBalancedBlock(content, tIdx + relativeTStart);
        if (!tBlock) break;

        const trackName = tMatch[1];
        const tContent = tBlock[1];
        const track: any = { instrument: 'default' };

        const instM = tContent.match(/instrument:\s*["']?(\w+)["']?/);
        if (instM) track.instrument = instM[1];

        const volM = tContent.match(/volume:\s*(-?\d+)/);
        if (volM) track.volume = parseInt(volM[1], 10);

        const panM = tContent.match(/pan:\s*(-?\d+\.?\d*)/);
        if (panM) track.pan = parseFloat(panM[1]);

        const sendM = tContent.match(/send:\s*\{\s*to:\s*["']?(\w+)["']?,\s*amount:\s*(\d+\.?\d*)\s*\}/);
        if (sendM) track.send = { to: sendM[1], amount: parseFloat(sendM[2]) };

        let val = "";
        const patIdx = tContent.indexOf("pattern:");
        if (patIdx !== -1) {
          const afterPat = tContent.slice(patIdx + 8).trim();
          if (afterPat.startsWith("euclidean")) {
            val = afterPat.match(/euclidean\([^)]*\)/)?.[0] || "";
          } else if (afterPat.startsWith('"') || afterPat.startsWith("'")) {
            const quote = afterPat[0];
            const endIdx = afterPat.indexOf(quote, 1);
            if (endIdx !== -1) val = afterPat.slice(0, endIdx + 1);
          } else if (afterPat.startsWith("[")) {
            let depth = 0;
            for (let i = 0; i < afterPat.length; i++) {
              if (afterPat[i] === '[') depth++;
              if (afterPat[i] === ']') depth--;
              val += afterPat[i];
              if (depth === 0) break;
            }
          }
        }

        if (val) {
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
        tIdx = content.indexOf(tBlock[0], tIdx + relativeTStart) + tBlock[0].length;
      }

      rawData.sections[sectionName] = section;
      searchIdx = block[2];
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
