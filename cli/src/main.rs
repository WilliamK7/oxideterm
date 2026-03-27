//! OxideTerm CLI — `oxt` command-line companion.
//!
//! Communicates with the running OxideTerm GUI via IPC
//! (Unix Domain Socket on macOS/Linux, Named Pipe on Windows).

mod connect;
mod output;
mod protocol;

use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::Shell;

#[derive(Parser)]
#[command(
    name = "oxt",
    about = "OxideTerm CLI companion — control OxideTerm from the command line",
    version
)]
struct Cli {
    /// Force JSON output (default: auto-detect based on terminal/pipe)
    #[arg(long, global = true)]
    json: bool,

    /// IPC timeout in milliseconds
    #[arg(long, global = true, default_value = "30000")]
    timeout: u64,

    /// Custom socket path (debugging)
    #[arg(long, global = true)]
    socket: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Show OxideTerm status
    Status,

    /// List resources
    List {
        #[command(subcommand)]
        what: ListTarget,
    },

    /// Show connection health
    Health {
        /// Session ID (omit to show all)
        session_id: Option<String>,
    },

    /// Disconnect a session
    Disconnect {
        /// Session ID or name to disconnect
        target: String,
    },

    /// Ping the GUI (connectivity check)
    Ping,

    /// Show version information
    Version,

    /// Generate shell completions
    Completions {
        /// Shell to generate completions for
        shell: Shell,
    },
}

#[derive(Subcommand)]
enum ListTarget {
    /// List saved connections
    Connections,
    /// List active sessions
    Sessions,
    /// List active port forwards
    Forwards {
        /// Session ID (omit to show all sessions)
        session_id: Option<String>,
    },
}

fn main() {
    let cli = Cli::parse();
    let out = output::OutputMode::detect(cli.json);

    let result = run(&cli, &out);

    if let Err(e) = result {
        if out.is_json() {
            let err = serde_json::json!({ "error": e });
            eprintln!("{}", serde_json::to_string(&err).unwrap_or_default());
        } else {
            eprintln!("error: {e}");
        }
        std::process::exit(1);
    }
}

fn run(cli: &Cli, out: &output::OutputMode) -> Result<(), String> {
    // Commands that don't need IPC
    match &cli.command {
        Commands::Version => {
            out.print_version();
            return Ok(());
        }
        Commands::Completions { shell } => {
            clap_complete::generate(
                *shell,
                &mut Cli::command(),
                "oxt",
                &mut std::io::stdout(),
            );
            return Ok(());
        }
        _ => {}
    }

    let mut conn = connect::IpcConnection::connect(cli.socket.as_deref(), cli.timeout)?;

    match &cli.command {
        Commands::Status => {
            let resp = conn.call("status", serde_json::json!({}))?;
            out.print_status(&resp);
        }
        Commands::List { what } => match what {
            ListTarget::Connections => {
                let resp = conn.call("list_saved_connections", serde_json::json!({}))?;
                out.print_connections(&resp);
            }
            ListTarget::Sessions => {
                let resp = conn.call("list_sessions", serde_json::json!({}))?;
                out.print_sessions(&resp);
            }
            ListTarget::Forwards { session_id } => {
                let params = match session_id {
                    Some(id) => serde_json::json!({ "session_id": id }),
                    None => serde_json::json!({}),
                };
                let resp = conn.call("list_forwards", params)?;
                out.print_forwards(&resp);
            }
        },
        Commands::Health { session_id } => {
            let params = match session_id {
                Some(id) => serde_json::json!({ "session_id": id }),
                None => serde_json::json!({}),
            };
            let resp = conn.call("health", params)?;
            out.print_health(&resp, session_id.is_some());
        }
        Commands::Disconnect { target } => {
            let resp = conn.call("disconnect", serde_json::json!({ "target": target }))?;
            out.print_disconnect(&resp);
        }
        Commands::Ping => {
            let resp = conn.call("ping", serde_json::json!({}))?;
            out.print_json(&resp);
        }
        Commands::Version | Commands::Completions { .. } => unreachable!(),
    }

    Ok(())
}
