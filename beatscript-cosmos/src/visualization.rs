//! Visualizations for the Beatscript app
//! Simplified version without canvas dependencies

use iced::{widget::{text, column}, Element, Theme};

#[derive(Debug, Clone)]
pub enum Message {}

pub struct WaveformVisualization {
    pub data: Vec<f32>,
    pub sample_rate: f32,
    pub channel_count: usize,
}

impl WaveformVisualization {
    pub fn new() -> Self {
        Self {
            data: vec![0.0; 1024], // Buffer for audio samples
            sample_rate: 44100.0,
            channel_count: 2,
        }
    }

    pub fn update_data(&mut self, new_data: &[f32]) {
        // Update the internal buffer with new audio data
        self.data.clear();
        self.data.extend_from_slice(new_data);
    }

    pub fn view(&self) -> Element<Message> {
        text("Waveform Visualization").into()
    }
}

pub struct SpectrumVisualization {
    pub spectrum_data: Vec<f32>,
    pub sample_rate: f32,
}

impl SpectrumVisualization {
    pub fn new() -> Self {
        Self {
            spectrum_data: vec![0.0; 512],
            sample_rate: 44100.0,
        }
    }

    pub fn update_spectrum(&mut self, fft_data: &[f32]) {
        // Update the spectrum data
        self.spectrum_data.clear();
        self.spectrum_data.extend_from_slice(fft_data);
    }

    pub fn view(&self) -> Element<Message> {
        text("Spectrum Visualization").into()
    }
}

pub struct KnobWidget {
    pub value: f32, // 0.0 to 1.0
    pub label: String,
    pub min: f32,
    pub max: f32,
    pub step: f32,
}

impl KnobWidget {
    pub fn new(value: f32, label: String, min: f32, max: f32) -> Self {
        Self {
            value,
            label,
            min,
            max,
            step: (max - min) / 100.0,
        }
    }

    pub fn set_value(&mut self, value: f32) {
        self.value = value.max(self.min).min(self.max);
    }

    pub fn get_value(&self) -> f32 {
        self.value
    }

    pub fn view(&self) -> Element<crate::KnobMessage> {
        text(format!("{}: {:.2}", self.label, self.value)).into()
    }
}

pub struct PianoRoll {
    pub pattern: Vec<Option<u8>>,
    pub rows: usize,
    pub cols: usize,
    pub selected_note: Option<u8>,
}

impl PianoRoll {
    pub fn new(rows: usize, cols: usize) -> Self {
        Self {
            pattern: vec![None; rows * cols],
            rows,
            cols,
            selected_note: None,
        }
    }

    pub fn toggle_note(&mut self, row: usize, col: usize) {
        let index = row * self.cols + col;
        if index < self.pattern.len() {
            self.pattern[index] = match self.pattern[index] {
                Some(_) => None,
                None => Some((self.rows - row) as u8 + 48), // MIDI note (C3 = 48)
            };
        }
    }

    pub fn view(&self) -> Element<crate::PianoRollMessage> {
        text("Piano Roll").into()
    }
}