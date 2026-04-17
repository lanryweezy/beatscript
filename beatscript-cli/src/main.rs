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

fn format_error(content: &str, err_str: &str) -> String {
    // Attempt to extract location from LALRPOP error string
    // e.g., "InvalidToken { location: 578 }" or "UnrecognizedToken { token: (250, ...), ... }"

    let location = if let Some(loc_idx) = err_str.find("location: ") {
        err_str[loc_idx+10..].chars().take_while(|c| c.is_digit(10)).collect::<String>().parse::<usize>().ok()
    } else if let Some(loc_idx) = err_str.find("token: (") {
        err_str[loc_idx+8..].chars().take_while(|c| c.is_digit(10)).collect::<String>().parse::<usize>().ok()
    } else {
        None
    };

    if let Some(loc) = location {
        let line_number = content[..loc].lines().count();
        let line_content = content.lines().nth(line_number.saturating_sub(1)).unwrap_or("");
        let col = loc - content[..loc].rfind('\n').map(|i| i + 1).unwrap_or(0);

        format!(
            "Error at line {}, column {}:\n\n  {}\n  {}^\n\nDetails: {}",
            line_number, col, line_content, " ".repeat(col), err_str
        )
    } else {
        err_str.to_string()
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Validate { path } => {
            let content = fs::read_to_string(path)?;
            match parser::parse_project(&content) {
                Ok(_) => println!("✅ File '{}' is valid BeatScript V12", path),
                Err(e) => {
                    eprintln!("❌ Validation failed for '{}':", path);
                    eprintln!("{}", format_error(&content, &e));
                    std::process::exit(1);
                }
            }
        }
        Commands::Expand { path } => {
            let content = fs::read_to_string(path)?;
            match parser::parse_project(&content) {
                Ok(project) => {
                    println!("{:#?}", project);
                }
                Err(e) => {
                    eprintln!("❌ Expansion failed:");
                    eprintln!("{}", format_error(&content, &e));
                    std::process::exit(1);
                }
            }
        }
    }

    Ok(())
}
