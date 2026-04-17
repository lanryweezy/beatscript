use lalrpop_util::lalrpop_mod;

lalrpop_mod!(pub beatscript);

use crate::lang::Project;

pub fn parse_project(input: &str) -> Result<Project, String> {
    let parser = beatscript::ProjectParser::new();
    parser.parse(input).map_err(|e| format!("{:?}", e))
}
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
                    pattern: euclid(3, 8)
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
                    pattern: [C3, _, G3, _]
                }
            }
        "#;
        let result = parse_program(code);
        assert!(result.is_ok());
    }
}
