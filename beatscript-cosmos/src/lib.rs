pub mod lang;
pub mod parser;
pub mod engine;
pub mod dsp;
pub mod audio_backend;
pub mod visualization;
pub mod midi;

#[derive(Debug, Clone)]
pub enum KnobMessage {
    ValueChange(f32),
}

#[derive(Debug, Clone)]
pub enum PianoRollMessage {
    NoteOn(u8),
    NoteOff(u8),
}
