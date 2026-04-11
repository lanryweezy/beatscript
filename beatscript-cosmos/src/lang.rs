//! BeatScript V12 Cosmos - Language Definition (AST)

use std::collections::HashMap;

pub type NodeId = u64;

#[derive(Debug, Clone, Default)]
pub struct Project {
    pub composition: Option<Composition>,
    pub timeline: Vec<String>,
    pub sections: Vec<Section>,
    pub synths: Vec<Synth>,
    pub fx_chains: Vec<FxChain>,
}

#[derive(Debug, Clone, Default)]
pub struct Composition {
    pub title: String,
    pub artist: String,
    pub key: String,
    pub bpm: u32,
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
    pub sends: Vec<SendEffect>,
}

impl Default for Track {
    fn default() -> Self {
        Self {
            name: String::new(),
            instrument: String::new(),
            pattern: Pattern::Notes(vec![]),
            sends: vec![],
        }
    }
}

#[derive(Debug, Clone)]
pub struct SendEffect {
    pub to: String,
    pub amount: f32,
}

#[derive(Debug, Clone)]
pub enum Pattern {
    Euclidean { hits: u8, steps: u8 },
    Notes(Vec<NoteEvent>),
}

#[derive(Debug, Clone)]
pub struct NoteEvent {
    pub time_steps: u32,
    pub notes: Vec<String>,
    pub velocity: u8,
    pub duration_steps: u32,
}

#[derive(Debug, Clone, Default)]
pub struct Synth {
    pub name: String,
    pub synth_type: String,
    pub parameters: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default)]
pub struct FxChain {
    pub name: String,
    pub effects: Vec<Effect>,
}

#[derive(Debug, Clone, Default)]
pub struct Effect {
    pub effect_type: String,
    pub parameters: HashMap<String, Value>,
}

#[derive(Debug, Clone, Copy)]
pub enum Waveform {
    Sine, Saw, Square, Triangle, Noise
}

#[derive(Debug, Clone)]
pub enum Value {
    Float(f32),
    Integer(i64),
    String(String),
    Note(String),
    Pattern(Vec<Option<String>>),
    Object(HashMap<String, Value>),
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
    Composition(Composition),
    Timeline(Vec<String>),
    Section(Section),
    Synth(Synth),
    FxChain(FxChain),
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
    Send(SendEffect),
}
