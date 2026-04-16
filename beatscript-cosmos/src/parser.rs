use lalrpop_util::lalrpop_mod;

lalrpop_mod!(pub beatscript);

use crate::lang::Project;

pub fn parse_project(input: &str) -> Result<Project, String> {
    let parser = beatscript::ProjectParser::new();
    parser.parse(input).map_err(|e| format!("{:?}", e))
}
