//! Advanced Audio Backend for Beatscript
//! Implements real-time audio processing with CPAL

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;


pub struct AudioBackend {
    pub sample_rate: f32,
    pub channels: usize,
    pub audio_graph: Arc<Mutex<AudioGraph>>,
}

pub struct AudioGraph {
    pub nodes: HashMap<String, Box<dyn AudioNode + Send>>,
    pub connections: Vec<(String, String)>, // (output_id, input_id)
    pub buffer_size: usize,
}

pub trait AudioNode {
    fn process(&mut self, input_samples: &[f32], output_samples: &mut [f32], dt: f32);
    fn set_parameter(&mut self, param: &str, value: f32);
    fn get_parameter(&self, param: &str) -> Option<f32>;
}

pub struct SynthNode {
    pub frequency: f32,
    pub phase: f32,
    pub waveform: Waveform,
    pub amplitude: f32,
    pub attack: f32,
    pub decay: f32,
    pub sustain: f32,
    pub release: f32,
    pub envelope_state: f32,
    pub is_playing: bool,
}

pub struct FilterNode {
    pub cutoff: f32,
    pub resonance: f32,
    pub filter_type: FilterType,
    pub last_input: [f32; 2], // For IIR filter
    pub last_output: [f32; 2],
}

pub struct DelayNode {
    pub delay_time: f32,
    pub feedback: f32,
    pub buffer: Vec<f32>,
    pub read_pos: usize,
    pub write_pos: usize,
}

pub struct ReverbNode {
    pub room_size: f32,
    pub damping: f32,
    pub wet: f32,
    pub dry: f32,
    pub buffer: Vec<[f32; 8]>, // 8 delay lines
    pub positions: [usize; 8],
}

pub struct LfoNode {
    pub frequency: f32,
    pub phase: f32,
    pub waveform: Waveform,
    pub depth: f32,
    pub output: f32,
}

#[derive(Clone, Copy)]
pub enum Waveform {
    Sine,
    Sawtooth,
    Square,
    Triangle,
    Noise,
}

#[derive(Clone, Copy)]
pub enum FilterType {
    LowPass,
    HighPass,
    BandPass,
    Notch,
}

impl AudioBackend {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("No output device available")?;
        
        let config = device.default_output_config()?;
        let sample_rate = config.sample_rate().0 as f32;
        let channels = config.channels() as usize;
        let buffer_size = 512; // Typical buffer size for low latency

        let audio_graph = Arc::new(Mutex::new(AudioGraph {
            nodes: HashMap::new(),
            connections: Vec::new(),
            buffer_size,
        }));

        Ok(AudioBackend {
            sample_rate,
            channels,
            audio_graph,
        })
    }

    pub fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Placeholder for actual audio start logic
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Placeholder for actual audio stop logic
        Ok(())
    }
}

impl AudioGraph {
    pub fn render_audio(&mut self, output: &mut [f32], dt: f32) {
        // Initialize output buffer to zero
        for sample in output.iter_mut() {
            *sample = 0.0;
        }

        // Process each audio node
        for (_, node) in self.nodes.iter_mut() {
            let mut temp_input = vec![0.0; output.len()];
            let mut temp_output = vec![0.0; output.len()];
            
            node.process(&temp_input, &mut temp_output, dt);
            
            // Mix the output into the main buffer
            for (out_sample, node_sample) in output.iter_mut().zip(temp_output.iter()) {
                *out_sample += node_sample * 0.1; // Scale down to prevent clipping
            }
        }
    }

    pub fn add_node(&mut self, id: String, node: Box<dyn AudioNode + Send>) {
        self.nodes.insert(id, node);
    }

    pub fn connect_nodes(&mut self, output_id: String, input_id: String) {
        self.connections.push((output_id, input_id));
    }

    pub fn remove_node(&mut self, id: &str) {
        self.nodes.remove(id);
    }

    pub fn get_node_mut(&mut self, id: &str) -> Option<&mut Box<dyn AudioNode + Send>> {
        self.nodes.get_mut(id)
    }
}

impl SynthNode {
    pub fn new() -> Self {
        Self {
            frequency: 440.0, // A4 note
            phase: 0.0,
            waveform: Waveform::Sine,
            amplitude: 0.5,
            attack: 0.1,
            decay: 0.3,
            sustain: 0.7,
            release: 0.2,
            envelope_state: 0.0,
            is_playing: false,
        }
    }

    fn generate_sample(&mut self, dt: f32) -> f32 {
        // Update phase
        self.phase += self.frequency * dt;
        if self.phase > 1.0 {
            self.phase -= self.phase.floor();
        }

        // Generate waveform
        let wave_sample = match self.waveform {
            Waveform::Sine => (self.phase * 2.0 * std::f32::consts::PI).sin(),
            Waveform::Sawtooth => (self.phase * 2.0 - 1.0) * 2.0, // -1 to 1
            Waveform::Square => if self.phase < 0.5 { 1.0 } else { -1.0 },
            Waveform::Triangle => {
                if self.phase < 0.25 {
                    self.phase * 8.0
                } else if self.phase < 0.75 {
                    2.0 - self.phase * 8.0
                } else {
                    self.phase * 8.0 - 4.0
                }
            }
            Waveform::Noise => (rand::random::<f32>() - 0.5) * 2.0,
        };

        // Apply envelope if note is playing
        if self.is_playing {
            // TODO: Implement proper ADSR envelope
            self.envelope_state = 1.0; // Simplified
        } else {
            self.envelope_state *= 0.99; // Release
        }

        wave_sample * self.amplitude * self.envelope_state
    }
}

impl AudioNode for SynthNode {
    fn process(&mut self, _input_samples: &[f32], output_samples: &mut [f32], dt: f32) {
        for sample in output_samples.iter_mut() {
            *sample = self.generate_sample(dt);
        }
    }

    fn set_parameter(&mut self, param: &str, value: f32) {
        match param {
            "frequency" => self.frequency = value,
            "amplitude" => self.amplitude = value.min(1.0).max(0.0),
            "attack" => self.attack = value,
            "decay" => self.decay = value,
            "sustain" => self.sustain = value.min(1.0).max(0.0),
            "release" => self.release = value,
            "playing" => self.is_playing = value > 0.0,
            _ => {}
        }
    }

    fn get_parameter(&self, param: &str) -> Option<f32> {
        match param {
            "frequency" => Some(self.frequency),
            "amplitude" => Some(self.amplitude),
            "attack" => Some(self.attack),
            "decay" => Some(self.decay),
            "sustain" => Some(self.sustain),
            "release" => Some(self.release),
            "playing" => Some(if self.is_playing { 1.0 } else { 0.0 }),
            _ => None,
        }
    }
}

impl FilterNode {
    pub fn new() -> Self {
        Self {
            cutoff: 1000.0,
            resonance: 0.7,
            filter_type: FilterType::LowPass,
            last_input: [0.0, 0.0],
            last_output: [0.0, 0.0],
        }
    }

    fn process_sample(&mut self, input: f32) -> f32 {
        // Simplified biquad filter implementation
        let cutoff_normalized = (self.cutoff / 22050.0).min(0.99).max(0.01); // Normalize to Nyquist
        let g = (std::f32::consts::PI * cutoff_normalized).tan();
        let k = 1.0 / self.resonance;
        
        // Simplified low-pass filter (biquad coefficients)
        let a1 = (1.0 - g) / (1.0 + g);
        let a2 = 0.0; // Simplified
        let b0 = (1.0 - a1) / 2.0;
        let b1 = b0;
        let b2 = 0.0; // Simplified
        
        let output = b0 * input + b1 * self.last_input[0] + b2 * self.last_input[1]
                    - a1 * self.last_output[0] - a2 * self.last_output[1];
        
        // Update delay elements
        self.last_input[1] = self.last_input[0];
        self.last_input[0] = input;
        self.last_output[1] = self.last_output[0];
        self.last_output[0] = output;
        
        output
    }
}

impl AudioNode for FilterNode {
    fn process(&mut self, input_samples: &[f32], output_samples: &mut [f32], _dt: f32) {
        for (input, output) in input_samples.iter().zip(output_samples.iter_mut()) {
            *output = self.process_sample(*input);
        }
    }

    fn set_parameter(&mut self, param: &str, value: f32) {
        match param {
            "cutoff" => self.cutoff = value.max(20.0).min(20000.0), // Hz
            "resonance" => self.resonance = value.max(0.1).min(10.0),
            "type" => {
                self.filter_type = match value as u32 {
                    0 => FilterType::LowPass,
                    1 => FilterType::HighPass,
                    2 => FilterType::BandPass,
                    3 => FilterType::Notch,
                    _ => FilterType::LowPass,
                };
            }
            _ => {}
        }
    }

    fn get_parameter(&self, param: &str) -> Option<f32> {
        match param {
            "cutoff" => Some(self.cutoff),
            "resonance" => Some(self.resonance),
            "type" => match self.filter_type {
                FilterType::LowPass => Some(0.0),
                FilterType::HighPass => Some(1.0),
                FilterType::BandPass => Some(2.0),
                FilterType::Notch => Some(3.0),
            },
            _ => None,
        }
    }
}

impl DelayNode {
    pub fn new(delay_time: f32, feedback: f32) -> Self {
        let buffer_size = (44100.0 * delay_time) as usize; // Assuming 44.1kHz sample rate
        Self {
            delay_time,
            feedback,
            buffer: vec![0.0; buffer_size.max(1)],
            read_pos: 0,
            write_pos: 0,
        }
    }
}

impl AudioNode for DelayNode {
    fn process(&mut self, input_samples: &[f32], output_samples: &mut [f32], _dt: f32) {
        for (input, output) in input_samples.iter().zip(output_samples.iter_mut()) {
            // Read delayed sample
            let delayed_sample = self.buffer[self.read_pos];
            
            // Mix input with delayed sample
            let mixed = *input + delayed_sample * self.feedback;
            
            // Write to buffer
            self.buffer[self.write_pos] = mixed;
            
            // Advance positions
            self.read_pos = (self.read_pos + 1) % self.buffer.len();
            self.write_pos = (self.write_pos + 1) % self.buffer.len();
            
            *output = mixed;
        }
    }

    fn set_parameter(&mut self, param: &str, value: f32) {
        match param {
            "delay_time" => {
                let new_buffer_size = (44100.0 * value) as usize;
                if new_buffer_size != self.buffer.len() {
                    self.buffer.resize(new_buffer_size.max(1), 0.0);
                    self.read_pos = 0;
                    self.write_pos = 0;
                }
                self.delay_time = value;
            },
            "feedback" => self.feedback = value.min(1.0).max(-1.0),
            _ => {}
        }
    }

    fn get_parameter(&self, param: &str) -> Option<f32> {
        match param {
            "delay_time" => Some(self.delay_time),
            "feedback" => Some(self.feedback),
            _ => None,
        }
    }
}

impl LfoNode {
    pub fn new() -> Self {
        Self {
            frequency: 1.0,
            phase: 0.0,
            waveform: Waveform::Sine,
            depth: 1.0,
            output: 0.0,
        }
    }

    fn generate_value(&mut self, dt: f32) -> f32 {
        self.phase += self.frequency * dt;
        if self.phase > 1.0 {
            self.phase -= self.phase.floor();
        }

        let value = match self.waveform {
            Waveform::Sine => (self.phase * 2.0 * std::f32::consts::PI).sin(),
            Waveform::Sawtooth => (self.phase * 2.0 - 1.0) * 2.0,
            Waveform::Square => if self.phase < 0.5 { 1.0 } else { -1.0 },
            Waveform::Triangle => {
                if self.phase < 0.25 {
                    self.phase * 8.0
                } else if self.phase < 0.75 {
                    2.0 - self.phase * 8.0
                } else {
                    self.phase * 8.0 - 4.0
                }
            }
            Waveform::Noise => (rand::random::<f32>() - 0.5) * 2.0,
        };

        self.output = value * self.depth;
        self.output
    }
}

impl AudioNode for LfoNode {
    fn process(&mut self, _input_samples: &[f32], output_samples: &mut [f32], dt: f32) {
        for sample in output_samples.iter_mut() {
            *sample = self.generate_value(dt);
        }
    }

    fn set_parameter(&mut self, param: &str, value: f32) {
        match param {
            "frequency" => self.frequency = value.max(0.01).min(20.0), // Hz
            "depth" => self.depth = value.min(1.0).max(-1.0),
            _ => {}
        }
    }

    fn get_parameter(&self, param: &str) -> Option<f32> {
        match param {
            "frequency" => Some(self.frequency),
            "depth" => Some(self.depth),
            _ => None,
        }
    }
}

// Add missing rand dependency to Cargo.toml
// For now, use a simple deterministic pseudo-random function
fn pseudo_random(seed: &mut u32) -> f32 {
    *seed = (*seed).wrapping_mul(1103515245).wrapping_add(12345);
    ((*seed >> 16) & 0x7FFF) as f32 / 32767.0
}