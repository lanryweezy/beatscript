//! BeatScript X "Janus" - Main Application with Aura Projectional UI

use iced::{
    executor,
    widget::{column, container, text, text_editor, row, slider, button, scrollable, toggler, checkbox, progress_bar},
    Application, Command, Element, Length, Settings, Theme,
};
use std::sync::{mpsc, Arc, Mutex};

// We conceptually use the unified core, but the GUI will be self-contained for this demonstration.
mod engine;
mod lang;
mod dsp;
mod parser;
mod audio_backend;
mod visualization;
mod midi;

use visualization::{WaveformVisualization, SpectrumVisualization, KnobWidget, PianoRoll};

// Type aliases for canvas messages
pub type PianoRollMessage = (usize, usize);
pub type KnobMessage = (String, f32);

fn main() -> iced::Result {
    // Initialize logger
    env_logger::init();
    
    // Launch the Iced GUI application.
    JanusApp::run(Settings {
        window: iced::window::Settings {
            size: iced::Size::new(1400.0, 900.0),
            ..Default::default()
        },
        ..Settings::default()
    })
}

// --- The State of the Application ---
struct JanusApp {
    editor_content: text_editor::Content,
    projection_view: Projection,
    // This channel sends commands to the audio thread (which we assume is running).
    command_sender: mpsc::Sender<String>,
    // Store the compiled audio graph
    audio_graph: Option<Arc<Mutex<dyn std::any::Any + Send>>>,
    // Audio backend
    audio_backend: Option<Arc<Mutex<audio_backend::AudioBackend>>>,
    // Visualization components
    waveform_viz: WaveformVisualization,
    spectrum_viz: SpectrumVisualization,
    // Control widgets
    master_volume: f32,
    is_playing: bool,
    is_recording: bool,
    bpm: u32,
    // Mixer controls
    mixer_controls: Vec<KnobWidget>,
    // Piano roll pattern editor
    piano_roll: PianoRoll,
    // Transport controls
    transport_position: f32,
    loop_start: f32,
    loop_end: f32,
}

// Represents the currently projected UI view.
#[derive(Default)]
enum Projection {
    #[default]
    Empty,
    Knob { label: String, value: f32, range: (f32, f32) },
    PianoRoll { pattern: Vec<bool> },
    MixerStrip { channel: String, volume: f32, pan: f32 },
    SpectrumAnalyzer,
}

// --- Events that drive the application ---
#[derive(Debug, Clone)]
enum Message {
    // Triggered when the text editor content changes.
    CodeChanged(text_editor::Action),
    // Triggered when a projected knob is moved.
    KnobChanged(f32),
    // A tick to check the cursor position for projection.
    Tick,
    // Compile the current code
    CompileCode,
    // Audio backend events
    Play,
    Stop,
    Record,
    // Transport controls
    TransportSeek(f32),
    ToggleLoop,
    // Mixer controls
    MasterVolumeChanged(f32),
    MixerControlChanged(String, f32),
    // Visualization updates
    UpdateWaveform(Vec<f32>),
    UpdateSpectrum(Vec<f32>),
    // Piano roll events
    PianoRollToggleNote(usize, usize),
    // Knob widget events
    KnobValueChanged(String, f32),
    // Canvas messages
    PianoRollMessage(PianoRollMessage),
    CanvasKnobMessage(KnobMessage),
}

impl Application for JanusApp {
    type Executor = executor::Default;
    type Message = Message;
    type Theme = Theme;
    type Flags = ();

    fn new(_flags: ()) -> (Self, Command<Message>) {
        // Initialize audio backend
        let audio_backend = match audio_backend::AudioBackend::new() {
            Ok(backend) => {
                let backend = Arc::new(Mutex::new(backend));
                // Audio start will be handled differently to avoid Send issue
                Some(backend)
            },
            Err(e) => {
                eprintln!("Failed to initialize audio: {}", e);
                None
            }
        };

        // In a real app, the audio thread would be spawned here.
        let (command_sender, _command_receiver) = mpsc::channel();

        let initial_code = r#"
// BeatScript Cosmos IDE
// High-performance algorithmic composition

composition {
    title: "Cosmos Genesis",
    bpm: 120
}

synth lead {
    type: "subtractive",
    cutoff: 1200,
    resonance: 5
}

section main {
    length: 4
    track melody {
        instrument: lead,
        pattern: [C3, E3, G3, B3, C4, _, _, _]
    }
}

timeline: [main]
"#;

        let mut mixer_controls = Vec::new();
        mixer_controls.push(KnobWidget::new(0.7, "Volume".to_string(), 0.0, 1.0));
        mixer_controls.push(KnobWidget::new(0.5, "Pan".to_string(), -1.0, 1.0));
        mixer_controls.push(KnobWidget::new(0.3, "Cutoff".to_string(), 20.0, 20000.0));

        let mut app = Self {
            editor_content: text_editor::Content::with_text(initial_code),
            projection_view: Projection::default(),
            command_sender,
            audio_graph: None,
            audio_backend,
            waveform_viz: WaveformVisualization::new(),
            spectrum_viz: SpectrumVisualization::new(),
            master_volume: 0.8,
            is_playing: false,
            is_recording: false,
            bpm: 120,
            mixer_controls,
            piano_roll: PianoRoll::new(32, 16), // 32 rows (notes), 16 columns (steps)
            transport_position: 0.0,
            loop_start: 0.0,
            loop_end: 4.0,
        };
        
        // Initialize MIDI support
        if let Err(e) = app.initialize_midi() {
            eprintln!("MIDI initialization error: {}", e);
        }

        (app, Command::none())
    }

    fn title(&self) -> String {
        String::from("BeatScript X - Janus Studio")
    }

    // The subscription ensures we get a `Tick` message regularly to update the projection.
    fn subscription(&self) -> iced::Subscription<Message> {
        iced::time::every(std::time::Duration::from_millis(50)).map(|_| Message::Tick)
    }

    fn update(&mut self, message: Message) -> Command<Message> {
        match message {
            Message::CodeChanged(action) => {
                self.editor_content.perform(action);
                let _ = self.command_sender.send(self.editor_content.text());
                
                // Try to compile the updated code
                if let Err(e) = self.compile_current_code() {
                    eprintln!("Compilation error: {}", e);
                }
            }
            Message::Tick => {
                // This is the heart of the projectional UI.
                // Check the current line at the cursor and update the projection view.
                let text = self.editor_content.text();
                let (line_num, _) = self.editor_content.cursor_position();
                if let Some(line) = text.lines().nth(line_num) {
                    self.update_projection_from_line(line);
                }
                
                // Update visualizations periodically
                // In a real app, this would receive real audio data
                let sample_data: Vec<f32> = (0..1024).map(|i| (i as f32 * 0.01).sin() * 0.3).collect();
                self.waveform_viz.update_data(&sample_data);
                
                // Process MIDI events periodically
                self.process_midi_events();
            }
            Message::KnobChanged(new_value) => {
                // This is the "two-way binding" simulation.
                // When the GUI knob is changed, we modify the text in the editor.
                let (line_num, _) = self.editor_content.cursor_position();
                let mut lines: Vec<String> = self.editor_content.text().lines().map(String::from).collect();
                if let Some(line) = lines.get_mut(line_num) {
                    if let Some(start) = line.find("rate:") {
                        *line = format!("    rate: {:.2}", new_value);
                        let new_text = lines.join("\n");
                        self.editor_content = text_editor::Content::with_text(&new_text);
                        let _ = self.command_sender.send(self.editor_content.text());
                        
                        // Recompile after modification
                        if let Err(e) = self.compile_current_code() {
                            eprintln!("Compilation error: {}", e);
                        }
                    }
                }
            }
            Message::CompileCode => {
                if let Err(e) = self.compile_current_code() {
                    eprintln!("Compilation error: {}", e);
                }
            }
            Message::Play => {
                if let Some(ref backend) = self.audio_backend {
                    if let Ok(mut b) = backend.lock() {
                        let _ = b.start();
                        self.is_playing = true;
                    }
                }
            }
            Message::Stop => {
                if let Some(ref backend) = self.audio_backend {
                    if let Ok(mut b) = backend.lock() {
                        let _ = b.stop();
                        self.is_playing = false;
                    }
                }
            }
            Message::Record => {
                self.is_recording = !self.is_recording;
            }
            Message::MasterVolumeChanged(vol) => {
                self.master_volume = vol.max(0.0).min(1.0);
            }
            Message::TransportSeek(pos) => {
                self.transport_position = pos;
            }
            Message::ToggleLoop => {
                // Toggle loop state - for now just print a message
                println!("Loop toggled");
            }
            Message::PianoRollToggleNote(row, col) => {
                self.piano_roll.toggle_note(row, col);
            }
            Message::KnobValueChanged(param_name, value) => {
                // Update parameters in the audio graph or send to audio backend
                // Placeholder - audio graph functionality is not fully implemented
                println!("Parameter {} updated to {}", param_name, value);
            }
            Message::PianoRollMessage((row, col)) => {
                self.piano_roll.toggle_note(row, col);
            }
            Message::CanvasKnobMessage((param_name, value)) => {
                // Update the corresponding knob in our local controls
                for knob in &mut self.mixer_controls {
                    if knob.label == param_name {
                        knob.set_value(value);
                        break;
                    }
                }
                
                // Send the update to the audio backend
                // Placeholder - audio graph functionality is not fully implemented
                println!("Parameter {} updated to {}", param_name, value);
            }
            Message::MixerControlChanged(_, _) => {
                // Placeholder for mixer control changes
            }
            Message::UpdateWaveform(_) => {
                // Placeholder for waveform updates
            }
            Message::UpdateSpectrum(_) => {
                // Placeholder for spectrum updates
            }
        }
        Command::none()
    }

    fn view(&self) -> Element<Message> {
        let editor = text_editor(&self.editor_content).on_action(Message::CodeChanged);

        let project_panel = container(
            column![
                text("PROJECT").size(16).style(iced::theme::Text::Color(iced::Color::from_rgb8(180, 180, 255))),
                scrollable(column![
                    text("main.bs").style(iced::theme::Text::Color(iced::Color::WHITE)),
                    text("synths/").style(iced::theme::Text::Color(iced::Color::from_rgb8(100, 200, 100))),
                    text("patterns/").style(iced::theme::Text::Color(iced::Color::from_rgb8(100, 200, 100))),
                    text("effects/").style(iced::theme::Text::Color(iced::Color::from_rgb8(100, 200, 100))),
                ])
            ]
            .spacing(5)
        )
        .padding(15)
        .width(Length::Fixed(200.0))
        .style(iced::theme::Container::Box);

        let transport_controls = row![
            button(text(if self.is_playing { "⏹" } else { "▶" }))
                .on_press(if self.is_playing { Message::Stop } else { Message::Play })
                .padding(10),
            button(text("●")).on_press(Message::Record).padding(10).style(
                if self.is_recording { 
                    iced::theme::Button::Destructive 
                } else { 
                    iced::theme::Button::Secondary 
                }
            ),
            button(text("↺")).on_press(Message::TransportSeek(0.0)).padding(10),
            slider(0.0..=100.0, self.transport_position, Message::TransportSeek).width(Length::Fill),
            text(format!("BPM: {}", self.bpm)).width(Length::Fixed(60.0))
        ]
        .spacing(10)
        .padding(10);

        let editor_area = column![
            editor,
            transport_controls
        ].spacing(5);

        let projection_panel = container(
            match &self.projection_view {
                Projection::Empty => column![
                    text("PROJECTION PANEL").size(16).style(iced::theme::Text::Color(iced::Color::from_rgb8(180, 200, 255))),
                    text("Click on a code element to project it here.").size(14)
                ].spacing(10).into(),
                Projection::Knob { label, value, range } => {
                    column![
                        text(label).size(16),
                        slider(range.0..=range.1, *value, Message::KnobChanged).step(0.01),
                        text(format!("{:.2}", value)).size(14)
                    ].spacing(10).into()
                }
                Projection::PianoRoll { .. } => {
                    self.piano_roll.view().map(|msg| Message::PianoRollMessage(msg))
                }
                Projection::MixerStrip { channel, volume, pan } => {
                    column![
                        text(channel).size(16),
                        text("Volume").size(12),
                        slider(0.0..=1.0, *volume, |v| Message::MixerControlChanged(channel.clone(), v)),
                        text("Pan").size(12),
                        slider(-1.0..=1.0, *pan, move |v| Message::MixerControlChanged(format!("{}_pan", channel.clone()), v))
                    ].spacing(5).into()
                }
                Projection::SpectrumAnalyzer => {
                    text("Spectrum Analyzer").into()
                }
            }
        )
        .padding(15)
        .width(Length::Fixed(300.0))
        .style(iced::theme::Container::Box);

        let visualization_panel = container(
            column![
                text("VISUALIZATION").size(16).style(iced::theme::Text::Color(iced::Color::from_rgb8(255, 180, 180))),
                text("Waveform visualization"),
                text("Spectrum visualization"),
            ].spacing(10)
        )
        .padding(15)
        .width(Length::FillPortion(2))
        .style(iced::theme::Container::Box);

        let mixer_panel = container(
            column![
                text("MIXER").size(16).style(iced::theme::Text::Color(iced::Color::from_rgb8(180, 255, 180))),
                text("Master Volume"),
                slider(0.0..=1.0, self.master_volume, Message::MasterVolumeChanged).height(120.0),
                text("Channel Strips")
            ].spacing(10)
        )
        .padding(10)
        .width(Length::FillPortion(1))
        .style(iced::theme::Container::Box);

        let bottom_panel = row![visualization_panel, mixer_panel].spacing(10);

        let main_content = column![
            row![project_panel, editor_area, projection_panel].spacing(10),
            bottom_panel
        ].spacing(10);

        let compile_button = button("COMPILE & RUN").on_press(Message::CompileCode).padding(10);

        column![
            container(compile_button).padding(10).center_x().width(Length::Fill),
            main_content
        ].into()
    }
}

impl JanusApp {
    // This function inspects a line of code and decides what UI to project.
    fn update_projection_from_line(&mut self, line: &str) {
        if line.contains("bpm:") {
            let value = line.split(":").last()
                .and_then(|s| s.trim().replace(",", "").parse::<f32>().ok())
                .unwrap_or(120.0);
            self.projection_view = Projection::Knob { 
                label: "Global Tempo".to_string(),
                value, 
                range: (40.0, 240.0)
            };
        } else if line.contains("pattern:") {
            self.projection_view = Projection::PianoRoll { pattern: vec![] };
        } else if line.contains("synth") {
            self.projection_view = Projection::MixerStrip { 
                channel: "Synth Params".to_string(),
                volume: 0.7, 
                pan: 0.0 
            };
        } else if line.contains("cutoff:") || line.contains("resonance:") {
            let value = line.split(":").last()
                .and_then(|s| s.trim().replace(",", "").parse::<f32>().ok())
                .unwrap_or(1000.0);
            self.projection_view = Projection::Knob {
                label: "Filter".to_string(),
                value,
                range: (20.0, 20000.0)
            };
        }
    }
    
    // Compile the current editor code
    fn compile_current_code(&mut self) -> Result<(), String> {
        let code = self.editor_content.text();
        match parser::parse_program(&code) {
            Ok(program) => {
                println!("Successfully parsed program with {} synths", program.synths.len());
                
                // Compile the program into an audio graph
                // For now, just acknowledge the parsing was successful
                println!("Successfully parsed program with {} synths", program.synths.len());
                self.audio_graph = Some(Arc::new(Mutex::new(true))); // Placeholder
                Ok(())
            }
            Err(e) => Err(format!("Failed to parse code: {}", e))
        }
    }
}

// MIDI support integration
impl JanusApp {
    pub fn initialize_midi(&mut self) -> Result<(), String> {
        // Initialize the MIDI manager
        let mut midi_manager = midi::MidiManager::new();
        midi_manager.scan_devices();
        
        // Connect to default MIDI devices if available
        if !midi_manager.input_devices.is_empty() {
            // We need to copy the ID to avoid borrowing issues
            let input_id = midi_manager.input_devices[0].id.clone();
            if let Err(e) = midi_manager.connect_input(&input_id) {
                eprintln!("Could not connect to MIDI input: {}", e);
            }
        }
        
        if !midi_manager.output_devices.is_empty() {
            // We need to copy the ID to avoid borrowing issues
            let output_id = midi_manager.output_devices[0].id.clone();
            if let Err(e) = midi_manager.connect_output(&output_id) {
                eprintln!("Could not connect to MIDI output: {}", e);
            }
        }
        
        Ok(())
    }
    
    pub fn process_midi_events(&mut self) {
        // Process any pending MIDI events
        // For now, just get and print the events
        // let midi_events = midi::MidiManager::new().get_pending_events();
        // 
        // for event in midi_events {
        //     println!("MIDI event: {:?}", event);
        // }
    }
}

// Custom slider style for master fader
struct MasterFaderStyle {}

impl iced::widget::slider::StyleSheet for MasterFaderStyle {
    type Style = iced::Theme;

    fn active(&self, style: &Self::Style) -> iced::widget::slider::Appearance {
        iced::widget::slider::Appearance {
            rail: iced::widget::slider::Rail {
                colors: (
                    iced::Color::from_rgb8(80, 80, 100),
                    iced::Color::from_rgb8(100, 100, 120)
                ),
                border_radius: 2.0.into(),
                width: 4.0,
            },
            handle: iced::widget::slider::Handle {
                shape: iced::widget::slider::HandleShape::Rectangle {
                    width: 20,
                    border_radius: 3.0.into(),
                },
                color: iced::Color::from_rgb8(200, 200, 220),
                border_width: 1.0,
                border_color: iced::Color::from_rgb8(150, 150, 180),
            },
        }
    }

    fn hovered(&self, style: &Self::Style) -> iced::widget::slider::Appearance {
        let active = self.active(style);
        iced::widget::slider::Appearance {
            handle: iced::widget::slider::Handle {
                color: iced::Color::from_rgb8(230, 230, 255),
                ..active.handle
            },
            ..active
        }
    }

    fn dragging(&self, style: &Self::Style) -> iced::widget::slider::Appearance {
        let active = self.active(style);
        iced::widget::slider::Appearance {
            handle: iced::widget::slider::Handle {
                color: iced::Color::from_rgb8(255, 255, 255),
                ..active.handle
            },
            ..active
        }
    }
}