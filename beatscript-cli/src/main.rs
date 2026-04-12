use clap::{Parser, Subcommand};
use beatscript_cosmos::parser;
use std::fs;
use anyhow::Result;

#[derive(Parser)]
#[command(author, version, about = "BeatScript CLI - Validate and Expand BeatScript files")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate a .beat file
    Validate {
        /// The path to the file to validate
        path: String,
    },
    /// Expand a .beat file into a JSON AST
    Expand {
        /// The path to the file to expand
        path: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Validate { path } => {
            let content = fs::read_to_string(path)?;
            match parser::parse_program(&content) {
                Ok(_) => println!("✅ File '{}' is valid BeatScript V12", path),
                Err(e) => {
                    eprintln!("❌ Validation failed for '{}':", path);
                    eprintln!("{}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Expand { path } => {
            let content = fs::read_to_string(path)?;
            match parser::parse_program(&content) {
                Ok(project) => {
                    println!("{:#?}", project);
                }
                Err(e) => {
                    eprintln!("❌ Expansion failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }

    Ok(())
}
