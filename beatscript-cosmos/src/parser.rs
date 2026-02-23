// src/parser.rs - BeatScript Parser Module

use crate::lang::Project;
use lalrpop_util::lalrpop_mod;

// This line includes the Rust code that LALRPOP generates from `beatscript.lalrpop`.
// The `#[allow]` attributes are to suppress warnings from the generated code.
#[allow(clippy::all)]
lalrpop_mod!(pub beatscript);

/// Parses a string of BeatScript V12 code into a Project AST.
/// Returns a Result which is either the parsed Project or a ParseError.
pub fn parse_program(source_code: &str) -> Result<Project, String> {
    let parser = beatscript::ProjectParser::new();
    match parser.parse(source_code) {
        Ok(project) => Ok(project),
        Err(e) => Err(format!("Parse Error: {}", e)),
    }
}