//! BeatScript Cosmos CLI - Validate .beat files

use std::env;
use std::fs;
use std::path::Path;

mod lang;
mod parser;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("Usage: beatscript-cli <file.beat>");
        return;
    }

    let filename = &args[1];
    let path = Path::new(filename);

    if !path.exists() {
        eprintln!("Error: File '{}' not found.", filename);
        std::process::exit(1);
    }

    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error reading file: {}", e);
            std::process::exit(1);
        }
    };

    println!("Validating '{}'...", filename);

    match parser::parse_program(&content) {
        Ok(project) => {
            println!("✅ Successfully validated BeatScript file.");
            if let Some(comp) = project.composition {
                println!("  Title:  {}", comp.title);
                println!("  Artist: {}", comp.artist);
                println!("  BPM:    {}", comp.bpm);
            }
            println!("  Synths:   {}", project.synths.len());
            println!("  Sections: {}", project.sections.len());
            println!("  Timeline: {} steps", project.timeline.len());
        }
        Err(e) => {
            eprintln!("❌ Validation failed!");
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}
