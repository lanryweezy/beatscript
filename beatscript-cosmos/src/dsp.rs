//! BeatScript V12 Cosmos - Digital Signal Processing (DSP) Primitives

use crate::lang::{Waveform};
use std::collections::HashMap;

pub const SAMPLE_RATE: f32 = 44100.0;

// A SynthGraph represents a single, playable synthesizer voice.
pub struct SynthGraph {
    // In a real implementation, this would hold a graph of DspNodes.
    // For now, it's a simple sine wave oscillator for demonstration.
    osc: SineOsc,
    env: Adsr,
}

impl SynthGraph {
    pub fn new_basic_subtractive() -> Self {
        Self {
            osc: SineOsc::new(SAMPLE_RATE),
            env: Adsr::new(SAMPLE_RATE),
        }
    }

    pub fn note_on(&mut self, note: u8) {
        let freq = 440.0 * 2.0f32.powf((note as f32 - 69.0) / 12.0);
        self.osc.set_freq(freq);
        self.env.note_on();
    }

    pub fn process(&mut self) -> f32 {
        self.osc.process() * self.env.process()
    }
}

// --- DSP Components ---
pub struct SineOsc { phase: f32, frequency: f32, sample_rate: f32 }
impl SineOsc {
    pub fn new(sample_rate: f32) -> Self { Self { phase: 0.0, frequency: 440.0, sample_rate } }
    pub fn set_freq(&mut self, frequency: f32) { self.frequency = frequency; }
    pub fn process(&mut self) -> f32 {
        let val = (self.phase * 2.0 * std::f32::consts::PI).sin();
        self.phase = (self.phase + self.frequency / self.sample_rate) % 1.0;
        val
    }
}

pub struct Adsr { state: AdsrState, output: f32, attack_rate: f32, decay_rate: f32, release_rate: f32, sustain_level: f32 }
#[derive(PartialEq, Clone, Copy)] pub enum AdsrState { Idle, Attack, Decay, Sustain, Release }
impl Adsr {
    pub fn new(sample_rate: f32) -> Self { Self { state: AdsrState::Idle, output: 0.0, attack_rate: 1.0/(0.01 * sample_rate), decay_rate: 1.0/(0.2 * sample_rate), release_rate: 1.0/(0.5 * sample_rate), sustain_level: 0.5 } }
    pub fn note_on(&mut self) { self.state = AdsrState::Attack; }
    pub fn note_off(&mut self) { if self.state != AdsrState::Idle { self.state = AdsrState::Release; } }
    pub fn process(&mut self) -> f32 {
        match self.state {
            AdsrState::Attack => { self.output += self.attack_rate; if self.output >= 1.0 { self.output = 1.0; self.state = AdsrState::Decay; } }
            AdsrState::Decay => { self.output -= self.decay_rate; if self.output <= self.sustain_level { self.output = self.sustain_level; self.state = AdsrState::Sustain; } }
            AdsrState::Sustain => {}
            AdsrState::Release => { self.output -= self.release_rate; if self.output <= 0.0 { self.output = 0.0; self.state = AdsrState::Idle; } }
            AdsrState::Idle => { self.output = 0.0; }
        }
        self.output
    }
}
