// build.rs - Build Script for BeatScript Cosmos

fn main() {
    // Tell Cargo to run LALRPOP on our grammar file.
    // This will generate a `beatscript.rs` file in the `OUT_DIR`.
    lalrpop::process_root().unwrap();
}
