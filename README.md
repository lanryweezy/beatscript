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

## Getting Started

### Using the Web Demo

#### Modern Web Player (React + TypeScript)
We are building a modern, interactive web player. To run it locally:
1.  Navigate to `beatscript-web`.
2.  Install dependencies: `npm install`.
3.  Start the dev server: `npm run dev`.
4.  Open your browser to the provided URL (usually `http://localhost:5173`).

#### Legacy Web Player
For a simple, zero-dependency experience, you can open `t.html` directly in your browser.

### Exploring the Cosmos Engine (Rust)

The Cosmos engine is located in the `beatscript-cosmos` directory. It uses the Iced GUI framework and CPAL for low-latency audio.

```bash
cd beatscript-cosmos
cargo run
```

*(Note: Requires Rust and system audio libraries like ALSA on Linux)*

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
