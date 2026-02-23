//! BeatScript V12 Cosmos - Language Definition (AST)

// This version is simplified and cleaned for compilability.

use std::collections::HashMap;

pub type NodeId = u64;

#[derive(Debug, Clone, Default)]
pub struct Project {
    pub timeline: Vec<String>,
    pub sections: Vec<Section>,
    pub synths: Vec<Synth>,
    // LFOs and other complex items removed for now.
}

#[derive(Debug, Clone, Default)]
pub struct Section {
    pub name: String,
    pub length_bars: u32,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone)]
pub struct Track {
    pub name: String,
    pub instrument: String,
    pub pattern: Pattern,
}

#[derive(Debug, Clone)]
pub enum Pattern {
    Euclidean { hits: u8, steps: u8 },
    Notes(Vec<NoteEvent>),
}

#[derive(Debug, Clone)]
pub struct NoteEvent {
    pub time_steps: u32,
    pub notes: Vec<u8>,
    pub velocity: u8,
    pub duration_steps: u32,
}

#[derive(Debug, Clone, Default)]
pub struct Synth {
    pub name: String,
    // Simplified for now
}

#[derive(Debug, Clone, Copy)]
pub enum Waveform {
    Sine, Saw, Square, Triangle, Noise
}

// Add the missing types to fix compilation errors
#[derive(Debug, Clone)]
pub enum Value {
    Float(f32),
    Integer(i64),
    String(String),
    Note(u8),
    Pattern(Vec<Option<u8>>),
}

#[derive(Debug, Clone)]
pub struct Program {
    pub bindings: Vec<(String, SignalExpr)>,
}

#[derive(Debug, Clone)]
pub enum SignalExpr {
    Literal(Value),
    FuncCall { name: String, args: HashMap<String, SignalExpr> },
    BinOp { op: Op, left: Box<SignalExpr>, right: Box<SignalExpr> },
    Ref(String),
}

#[derive(Debug, Clone, Copy)]
pub enum Op { Add, Subtract, Multiply, Divide }

// TopLevelItem enum for the parser
#[derive(Debug, Clone)]
pub enum TopLevelItem {
    Timeline(Vec<String>),
    Section(Section),
    Synth(Synth),
}

// SectionItem enum for the parser
#[derive(Debug, Clone)]
pub enum SectionItem {
    Length(u32),
    Track(Track),
}

// TrackItem enum for the parser
#[derive(Debug, Clone)]
pub enum TrackItem {
    Instrument(String),
    Pattern(Pattern),
}