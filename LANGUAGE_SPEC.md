# BeatScript Language Specification v12

BeatScript is a declarative, block-based domain-specific language for music composition and synthesis.

## Core Structure

A BeatScript file is composed of four main block types: `composition`, `synth`, `section`, and `timeline`.

### 1. Composition Block
Defines global metadata and settings for the piece.

```beatscript
composition {
    title: "My Awesome Track",
    artist: "Aethel",
    bpm: 120,
    key: "C minor"
}
```

### 2. Synth Block
Defines a synthesizer instrument and its parameters.

```beatscript
synth my_synth {
    type: "subtractive", // options: subtractive, fm, membrane, noise, physical_model
    oscillator: "sine",
    attack: 0.1,
    decay: 0.2,
    sustain: 0.7,
    release: 0.5
}
```

### 3. Section Block
Defines a musical section with a specific length and a set of tracks.

```beatscript
section verse {
    length: 4 // number of bars
    track kick {
        instrument: my_kick_synth,
        pattern: "1000100010001000" // 16-step rhythmic string
    }
    track melody {
        instrument: my_lead_synth,
        pattern: [C3, _, Eb3, _, G3, _, _, _] // melodic array
    }
}
```

### 4. Timeline
Defines the order in which sections are played.

```beatscript
timeline: [verse, chorus, verse, fade]
```

## Syntax Details

- **Comments:** Use `//` for single-line comments.
- **Identifiers:** Names for synths and sections must start with a letter or underscore.
- **Strings:** Double quotes `"..."` are used for string values.
- **Numbers:** Integers and floats are supported for parameters.
- **Arrays:** Square brackets `[...]` are used for lists of identifiers or notes.
- **Rhythmic Patterns:** A string of `1`s (hit) and `0`s (rest), typically 16 steps long.
- **Melodic Patterns:** An array of note names (e.g., `C3`, `Eb4`) or underscores `_` for rests.

## Advanced Features

### Euclidean Rhythms
Generate rhythmic patterns mathematically based on Euclidean algorithm distribution.

```beatscript
pattern: euclidean(5, 16)         // 5 hits evenly distributed over 16 steps
pattern: euclidean(3, 8, 1)      // 3 hits over 8 steps, rotated by 1
```

### Chords and Polyphony
Tracks can play multiple notes simultaneously using chord notation or nested arrays.

```beatscript
track pads {
    instrument: "polysynth",
    pattern: [Cm7, _, F7, _, Bbmaj7, _, _, _]
}
```

### FX Chains
### Euclidean Rhythms (Cosmos Engine only)
Generate rhythmic patterns mathematically.

```beatscript
pattern: euclid(5, 8) // 5 hits distributed over 8 steps
```

### FX Chains (Cosmos Engine only)
Define reusable effect chains.

```beatscript
fx_chain space_reverb {
    reverb { size: 0.9, wet: 0.4 }
    delay { time: 0.5, feedback: 0.6 }
}

track melody {
    instrument: my_synth,
    pattern: [...],
    send: { to: "space_reverb", amount: 0.7 }
}
```
