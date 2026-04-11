# BeatScript Cosmos Engine

The Cosmos engine is the high-performance, native implementation of the BeatScript language, written in Rust. It is designed for low-latency audio synthesis and complex algorithmic composition.

## Features

- **Low-latency Audio:** Uses `cpal` for cross-platform audio I/O.
- **Advanced Grammar:** Supports the full BeatScript v12 specification, including FX chains and Euclidean rhythms.
- **Projectional IDE:** Features a built-in GUI built with `iced` that offers a projectional editing experience.
- **CLI Tooling:** Includes `beatscript-cli` for script validation and MIDI export (experimental).

## Prerequisites

### Linux
You will need the ALSA development headers:
```bash
sudo apt-get install libasound2-dev
```

### macOS / Windows
No additional system dependencies are typically required beyond a working Rust toolchain.

## Building and Running

To run the Cosmos IDE:
```bash
cargo run
```

To use the CLI:
```bash
cargo run --bin beatscript-cli -- path/to/your/script.beat
```

## Implementation Details

- **Parser:** Generated using `lalrpop`.
- **Audio Synthesis:** Real-time synthesis logic is located in `engine.rs`.
- **UI:** The projectional interface logic is in `main.rs` and the `ui/` module.

## Future Development

- [ ] VST/AU Plugin support.
- [ ] Improved MIDI mapping for external controllers.
- [ ] Multi-threaded audio graph processing.
