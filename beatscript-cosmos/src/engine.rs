//! BeatScript V12 Cosmos - The Core Audio Engine (Timeline Architecture)

use crate::lang::{self, Project, Pattern, NoteEvent, Synth as SynthDef, Section as SectionDef};
use crate::dsp::{self, SynthGraph, SAMPLE_RATE};
use crossbeam::channel::{Receiver};
use std::collections::HashMap;

type NodeId = u64;

pub enum EngineCommand {
    Play,
    Stop,
    UpdateProject(Box<Project>),
}

//==============================================================================
//  Audio Engine
//==============================================================================

pub struct AudioEngine {
    transport: Transport,
    synth_graphs: HashMap<NodeId, SynthGraph>,
    command_receiver: Receiver<EngineCommand>,
    sample_rate: f32,
    node_id_counter: NodeId,
}

impl AudioEngine {
    pub fn new(command_receiver: Receiver<EngineCommand>, sample_rate: f32) -> Self {
        Self {
            transport: Transport::new(sample_rate),
            synth_graphs: HashMap::new(),
            command_receiver,
            sample_rate,
            node_id_counter: 0,
        }
    }

    pub fn process_block(&mut self, output: &mut [f32]) {
        if let Ok(command) = self.command_receiver.try_recv() { self.handle_command(command); }

        self.transport.process(&mut self.synth_graphs);

        for sample in output.iter_mut() { *sample = 0.0; }
        for graph in self.synth_graphs.values_mut() {
            for sample in output.iter_mut() { *sample += graph.process(); }
        }
    }

    fn handle_command(&mut self, command: EngineCommand) {
        match command {
            EngineCommand::UpdateProject(project) => self.load_project(*project),
            EngineCommand::Play => self.transport.play(),
            EngineCommand::Stop => self.transport.stop(),
        }
    }

    fn load_project(&mut self, project: Project) {
        println!("Audio Engine: Loading new project...");
        self.synth_graphs.clear();
        self.node_id_counter = 0;

        let bpm = project.composition.as_ref().map(|c| c.bpm as f32).unwrap_or(120.0);
        self.transport.bpm = bpm;

        let mut synth_map: HashMap<String, NodeId> = HashMap::new();
        for synth_def in &project.synths {
            let id = self.new_node_id();
            println!("  - Building synth: {}", synth_def.name);
            let graph = SynthGraph::new_basic_subtractive();
            self.synth_graphs.insert(id, graph);
            synth_map.insert(synth_def.name.clone(), id);
        }

        let mut section_players = HashMap::new();
        for section_def in &project.sections {
            println!("  - Creating section player for: {}", section_def.name);
            let player = SectionPlayer::new(section_def, &synth_map);
            section_players.insert(section_def.name.clone(), player);
        }

        self.transport.load_timeline(project.timeline, section_players);
    }

    fn new_node_id(&mut self) -> NodeId { self.node_id_counter += 1; self.node_id_counter }
}

//==============================================================================
//  Transport & Sequencing
//==============================================================================

struct Transport {
    sample_rate: f32,
    playhead_samples: u64,
    is_playing: bool,
    bpm: f32,
    timeline: Vec<String>,
    section_players: HashMap<String, SectionPlayer>,
    current_section_index: usize,
    section_playhead_samples: u64,
}

impl Transport {
    fn new(sample_rate: f32) -> Self {
        Self { sample_rate, playhead_samples: 0, is_playing: false, bpm: 120.0, timeline: vec![], section_players: HashMap::new(), current_section_index: 0, section_playhead_samples: 0 }
    }

    fn load_timeline(&mut self, timeline: Vec<String>, players: HashMap<String, SectionPlayer>) {
        println!("Transport: Loading timeline: {:?}", timeline);
        self.timeline = timeline;
        self.section_players = players;
    }

    fn process(&mut self, synths: &mut HashMap<NodeId, SynthGraph>) {
        if !self.is_playing || self.timeline.is_empty() { return; }

        let section_name = &self.timeline[self.current_section_index];
        if let Some(player) = self.section_players.get(section_name) {
            player.process(self.section_playhead_samples, self.bpm, synths);
            
            let section_length_samples = (player.length_beats * 60.0 / self.bpm * self.sample_rate) as u64;
            if self.section_playhead_samples >= section_length_samples {
                self.section_playhead_samples = 0; // Reset for next section
                self.current_section_index = (self.current_section_index + 1) % self.timeline.len();
                println!("Transport: Transitioning to section: {}", self.timeline[self.current_section_index]);
            }
        } else {
            self.stop();
            return;
        }
        self.playhead_samples += 1;
        self.section_playhead_samples += 1;
    }

    fn play(&mut self) { self.is_playing = true; self.playhead_samples = 0; self.section_playhead_samples = 0; self.current_section_index = 0; println!("Transport: Play"); }
    fn stop(&mut self) { self.is_playing = false; println!("Transport: Stop"); }
}

struct SectionPlayer {
    name: String,
    length_beats: f32,
    tracks: Vec<(NodeId, Vec<NoteEvent>)>, // (Synth ID, Notes)
}

impl SectionPlayer {
    fn new(section_def: &SectionDef, synth_map: &HashMap<String, NodeId>) -> Self {
        let mut tracks = vec![];
        for track_def in &section_def.tracks {
            if let Some(synth_id) = synth_map.get(&track_def.instrument) {
                let notes = unroll_pattern(&track_def.pattern);
                tracks.push((*synth_id, notes));
            }
        }
        Self { name: section_def.name.clone(), length_beats: section_def.length_bars as f32 * 4.0, tracks }
    }

    fn process(&self, playhead_samples: u64, bpm: f32, synths: &mut HashMap<NodeId, SynthGraph>) {
        let samples_per_beat = 60.0 / bpm * SAMPLE_RATE;
        let samples_per_16th = samples_per_beat / 4.0;

        for (synth_id, notes) in &self.tracks {
            for note in notes {
                let note_start_sample = (note.time_steps as f32 * samples_per_16th) as u64;
                if playhead_samples == note_start_sample {
                    if let Some(synth) = synths.get_mut(synth_id) {
                        if let Some(note_name) = note.notes.get(0) {
                            let midi = note_to_midi(note_name);
                            println!("  > Section '{}': Triggering note {} ({}) on synth {}", self.name, note_name, midi, synth_id);
                            synth.note_on(midi);
                        }
                    }
                }
            }
        }
    }
}

fn unroll_pattern(pattern: &Pattern) -> Vec<NoteEvent> {
    match pattern {
        Pattern::Notes(notes) => notes.clone(),
        Pattern::Euclidean { hits, steps, rotate } => {
            let mut notes = vec![];
            let k = *hits as f32;
            let n = *steps as f32;
            for i in 0..*steps {
                let val = ((i as f32 * k) / n).floor() != (((i as f32 - 1.0) * k) / n).floor();
                if val {
                    // Apply rotation
                    let rotated_i = (i as u32 + *rotate as u32) % *steps as u32;
                    notes.push(NoteEvent {
                        time_steps: rotated_i,
                        notes: vec!["C3".to_string()], // Default for Euclidean
                        velocity: 100,
                        duration_steps: 1,
                    });
                }
            }
            notes.sort_by_key(|n| n.time_steps);
            notes
        }
    }
}

/// Simple utility to convert note names (e.g., "C3", "Eb4") to MIDI numbers.
pub fn note_to_midi(name: &str) -> u8 {
    let mut parts = name.chars();
    let note = match parts.next() {
        Some('C') => 0,
        Some('D') => 2,
        Some('E') => 4,
        Some('F') => 5,
        Some('G') => 7,
        Some('A') => 9,
        Some('B') => 11,
        _ => 0,
    };

    let mut next = parts.next();
    let mut offset = 0;
    if next == Some('b') {
        offset = -1;
        next = parts.next();
    } else if next == Some('#') {
        offset = 1;
        next = parts.next();
    }

    let octave = next.and_then(|c| c.to_digit(10)).unwrap_or(4) as i32;
    (12 * (octave + 1) + note + offset) as u8
}
