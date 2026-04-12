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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_full_composition() {
        let code = r#"
            composition {
                title: "Test Track",
                bpm: 120
            }
            synth my_synth {
                type: "subtractive"
            }
            section main {
                length: 4
                track kick {
                    instrument: my_synth,
                    pattern: euclidean(3, 8, 1)
                }
            }
            timeline: [main]
        "#;
        let result = parse_program(code);
        assert!(result.is_ok(), "Should parse successfully: {:?}", result.err());
        let project = result.unwrap();
        assert_eq!(project.composition.as_ref().unwrap().title, "Test Track");
        assert_eq!(project.timeline, vec!["main"]);
    }

    #[test]
    fn test_parse_complex_pattern() {
        let code = r#"
            section s {
                track t {
                    pattern: [C3, _, [G3, B3], _]
                }
            }
        "#;
        let result = parse_program(code);
        assert!(result.is_ok());
    }
}