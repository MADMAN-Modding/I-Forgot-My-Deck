use std::process::Command;
use std::path::Path;

fn main() {
    // Where we want to write TypeScript types
    let out_path = Path::new("../ifmd-frontend/src/types.ts");

    // Run `cargo tsync`
    let output = Command::new("tsync")
        .args(&["--input=src/", format!("--output={}", out_path.to_str().unwrap()).as_str()])
        .output()
        .expect("Failed to run `cargo tsync`. Make sure tsync is installed.");

    if !output.status.success() {
        panic!(
            "tsync failed:\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    // Rebuild when Rust type definitions change
    println!("cargo:rerun-if-changed=src/");
}
