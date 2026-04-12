# BeatScript: The Language of Algorithmic Rhythm

BeatScript is a declarative, domain-specific language (DSL) designed for music creation, algorithmic composition, and live coding. It allows you to describe musical structures, instruments, and effects in a human-readable format that can be parsed and performed by various audio engines.

## What is BeatScript useful for?

*   **Algorithmic Music:** Easily define complex rhythmic and melodic patterns using mathematical concepts like Euclidean rhythms.
*   **Live Coding:** Modify your music in real-time by changing the script, making it perfect for live performances.
*   **Declarative Sound Design:** Describe your synthesizers and effect chains in code, making them reproducible and easy to share.
*   **Rapid Prototyping:** Quickly sketch out musical ideas without needing a full DAW (Digital Audio Workstation).
*   **Living Compositions:** Create music that can evolve over time or respond to external data.

## Who is it for?

*   **Musicians & Composers:** Looking for new ways to explore rhythm and melody beyond traditional notation or DAW grids.
*   **Creative Coders:** Interested in audio synthesis and generative art.
*   **Sound Designers:** Who want to build and document instruments and FX chains using code.
*   **Educators:** A simple way to teach music theory and synthesis through a programmable interface.

## Project Structure

This repository contains two main implementations of BeatScript:

1.  **BeatScript Web (Legacy/Demo):** A simple browser-based player using Tone.js (currently being upgraded to a modern React/TypeScript application).
2.  **BeatScript Cosmos:** A next-generation high-performance audio engine written in Rust, featuring a projectional IDE.

## Quick Start

### 🎹 For Musicians (No Coding Required)
1.  **Launch the Studio:** [Link to hosted version or local dev server]
2.  **Pick a Vibe:** Use the dropdown at the top to load a preset like "Neon Sunset" or "Deep Techno".
3.  **Hit PLAY:** Experience the algorithmic magic.
4.  **Tweak:** Click on patterns or synth parameters in the code; use the "Projection" sliders on the right to shape your sound in real-time.
5.  **Record:** Hit the Record button to save your session as a high-quality audio file.

### 🛠 For Developers & Sound Designers
1.  **Clone the Repo:** `git clone https://github.com/jules/beatscript.git`
2.  **Web Studio (React):**
    ```bash
    cd beatscript-web
    npm install
    npm run dev
    ```
3.  **Native Engine (Rust):**
    ```bash
    cd beatscript-cosmos
    cargo run
    ```
    *Prerequisites: `libasound2-dev` on Linux.*

4.  **CLI Tools:**
    Validate your scripts using the new `beatscript-cli`:
    ```bash
    cd beatscript-cli
    cargo run -- validate ../examples/ambient_space.beat
    ```

## Modern Features for Mass Adoption

- **Euclidean Rhythm Generator:** Create complex, mathematical beats with `euclidean(hits, steps, rotate)`.
- **Projection UI:** A bridge between code and touch. Click any code block to reveal interactive GUI controls.
- **Polyphonic Support:** Compose rich textures using chord notation (e.g., `[Cmaj7, _, Am7, _]`).
- **Sample Manager:** Drag and drop your own WAV/MP3 samples directly into the browser.
- **MIDI Integration:** Plug in your MIDI controller and play the internal synths live.
- **Shareable URLs:** Every composition is encoded into a unique URL hash. Share your music with a single link.

## Example BeatScript

```beatscript
composition {
    title: "First Light",
    bpm: 70
}

synth felt_piano {
    type: physical_model,
    material: "felted_wool"
}

section melody {
    length: 4
    track piano_melody {
        instrument: felt_piano,
        pattern: [G3, _, Eb4, _, D4, _, C4, _, G3, _, _, _, _, _, _, _]
    }
}

timeline: [melody]
```

## Future Vision: Mass Adoption

To make BeatScript accessible to everyone, we are focusing on:
*   **Modern Web Tooling:** Building a robust, interactive web-based playground with React and TypeScript.
*   **Standardization:** Refining the BeatScript grammar to support more complex musical expressions while maintaining simplicity.
*   **Integration:** Making it easy to export BeatScript compositions to MIDI, WAV, or use it as a plugin in other software.
