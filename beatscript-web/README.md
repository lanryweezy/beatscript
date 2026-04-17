# BeatScript Studio (Web)

The official web-based IDE and performance environment for BeatScript. Built with React, Tone.js, and Monaco Editor.

## Features
- **Modern Code Editor**: Syntax highlighting and error diagnostics for `.beat` files.
- **Projection UI**: Interactive visualizers for ADSR envelopes and Euclidean rhythms.
- **High-Fidelity Audio**: Powered by Tone.js with a master limiter for professional sound.
- **Session Export**: Record your live coding sessions directly to high-quality audio files.
- **MIDI Integration**: Export your compositions to standard MIDI files for use in any DAW.
- **Sharing**: Encodes your entire project into a shareable URL hash.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Architecture
- `src/core`: Pure logic, including the schema-validated parser and MIDI export logic.
- `src/components/studio`: Reusable UI components for the performance environment.
- `src/App.tsx`: The main application shell and audio lifecycle management.
