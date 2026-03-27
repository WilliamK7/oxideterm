//! Output formatting for CLI responses.
//!
//! Automatically detects terminal vs pipe context.
//! - Terminal: human-readable colored tables
//! - Pipe: structured JSON

use std::io::IsTerminal;

use serde_json::Value;

/// Output mode for CLI responses.
pub enum OutputMode {
    Human,
    Json,
}

impl OutputMode {
    /// Detect output mode based on terminal detection and flags.
    pub fn detect(force_json: bool) -> Self {
        if force_json || !is_terminal_stdout() {
            Self::Json
        } else {
            Self::Human
        }
    }

    pub fn is_json(&self) -> bool {
        matches!(self, Self::Json)
    }

    /// Print raw JSON value (pretty for human, compact for pipe).
    pub fn print_json(&self, value: &Value) {
        match self {
            Self::Human => {
                println!(
                    "{}",
                    serde_json::to_string_pretty(value).unwrap_or_default()
                );
            }
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
        }
    }

    /// Print status response.
    pub fn print_status(&self, value: &Value) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                let version = value
                    .get("version")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let sessions = value
                    .get("sessions")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let ssh = value
                    .pointer("/connections/ssh")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let local = value
                    .pointer("/connections/local")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);

                println!("OxideTerm v{version}");
                println!("  Sessions:      {sessions} active");
                println!("  Connections:   {ssh} SSH, {local} local");
            }
        }
    }

    /// Print saved connections list.
    pub fn print_connections(&self, value: &Value) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                let items = value.as_array().map(|a| a.as_slice()).unwrap_or(&[]);
                if items.is_empty() {
                    println!("No saved connections");
                    return;
                }

                println!(
                    "  {:<16} {:<24} {:<6} {:<10} {}",
                    "NAME", "HOST", "PORT", "USER", "TYPE"
                );
                for item in items {
                    let name = item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let host = item
                        .get("host")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let port = item
                        .get("port")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(22);
                    let user = item
                        .get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let auth = item
                        .get("auth_type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    println!("  {:<16} {:<24} {:<6} {:<10} {}", name, host, port, user, auth);
                }
            }
        }
    }

    /// Print active sessions list.
    pub fn print_sessions(&self, value: &Value) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                let items = value.as_array().map(|a| a.as_slice()).unwrap_or(&[]);
                if items.is_empty() {
                    println!("No active sessions");
                    return;
                }

                println!(
                    "  {:<14} {:<16} {:<24} {:<10} {}",
                    "ID", "NAME", "HOST", "STATE", "UPTIME"
                );
                for item in items {
                    let id = item
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let short_id = if id.len() > 12 { &id[..12] } else { id };
                    let name = item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let host = item
                        .get("host")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let state = item
                        .get("state")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let uptime = item
                        .get("uptime_secs")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    let uptime_str = format_duration(uptime);
                    println!(
                        "  {:<14} {:<16} {:<24} {:<10} {}",
                        short_id, name, host, state, uptime_str
                    );
                }
            }
        }
    }

    /// Print port forwards list.
    pub fn print_forwards(&self, value: &Value) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                let items = value.as_array().map(|a| a.as_slice()).unwrap_or(&[]);
                if items.is_empty() {
                    println!("No active port forwards");
                    return;
                }

                println!(
                    "  {:<10} {:<8} {:<24} {:<24} {:<10} {}",
                    "SESSION", "TYPE", "BIND", "TARGET", "STATUS", "DESC"
                );
                for item in items {
                    let session = item
                        .get("session_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let short_session = if session.len() > 8 { &session[..8] } else { session };
                    let fwd_type = item
                        .get("forward_type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let bind_addr = item
                        .get("bind_address")
                        .and_then(|v| v.as_str())
                        .unwrap_or("0.0.0.0");
                    let bind_port = item
                        .get("bind_port")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    let target_host = item
                        .get("target_host")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let target_port = item
                        .get("target_port")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    let status = item
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");
                    let desc = item
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    let bind_str = format!("{bind_addr}:{bind_port}");
                    let target_str = if fwd_type == "dynamic" {
                        "SOCKS5".to_string()
                    } else {
                        format!("{target_host}:{target_port}")
                    };

                    println!(
                        "  {:<10} {:<8} {:<24} {:<24} {:<10} {}",
                        short_session, fwd_type, bind_str, target_str, status, desc
                    );
                }
            }
        }
    }

    /// Print health status.
    pub fn print_health(&self, value: &Value, single: bool) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                if single {
                    // Single session health (QuickHealthCheck)
                    let status = value
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");
                    let latency = value
                        .get("latency_ms")
                        .and_then(|v| v.as_u64());
                    let message = value
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let session_id = value
                        .get("session_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("-");

                    let status_icon = match status {
                        "healthy" => "●",
                        "degraded" => "◐",
                        "unresponsive" => "○",
                        "disconnected" => "✕",
                        _ => "?",
                    };

                    let latency_str = latency
                        .map(|l| format!("{l}ms"))
                        .unwrap_or_else(|| "-".to_string());

                    println!("{status_icon} {session_id}");
                    println!("  Status:    {status}");
                    println!("  Latency:   {latency_str}");
                    println!("  Message:   {message}");
                } else {
                    // All sessions health (HashMap<String, QuickHealthCheck>)
                    let obj = value.as_object();
                    if obj.map(|o| o.is_empty()).unwrap_or(true) {
                        println!("No active sessions with health data");
                        return;
                    }

                    println!(
                        "  {:<14} {:<14} {:<10} {}",
                        "SESSION", "STATUS", "LATENCY", "MESSAGE"
                    );
                    if let Some(map) = obj {
                        for (session_id, check) in map {
                            let short_id = if session_id.len() > 12 {
                                &session_id[..12]
                            } else {
                                session_id
                            };
                            let status = check
                                .get("status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown");
                            let latency = check
                                .get("latency_ms")
                                .and_then(|v| v.as_u64())
                                .map(|l| format!("{l}ms"))
                                .unwrap_or_else(|| "-".to_string());
                            let message = check
                                .get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            println!(
                                "  {:<14} {:<14} {:<10} {}",
                                short_id, status, latency, message
                            );
                        }
                    }
                }
            }
        }
    }

    /// Print disconnect result.
    pub fn print_disconnect(&self, value: &Value) {
        match self {
            Self::Json => {
                println!("{}", serde_json::to_string(value).unwrap_or_default());
            }
            Self::Human => {
                let success = value
                    .get("success")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let session_id = value
                    .get("session_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                if success {
                    println!("Disconnected session: {session_id}");
                } else {
                    let error = value
                        .get("error")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown error");
                    println!("Failed to disconnect: {error}");
                }
            }
        }
    }

    /// Print version information.
    pub fn print_version(&self) {
        let version = env!("CARGO_PKG_VERSION");
        match self {
            Self::Json => {
                println!(
                    "{}",
                    serde_json::to_string(&serde_json::json!({
                        "cli_version": version
                    }))
                    .unwrap_or_default()
                );
            }
            Self::Human => {
                println!("oxt {version}");
            }
        }
    }
}

fn format_duration(secs: u64) -> String {
    if secs < 60 {
        format!("{secs}s")
    } else if secs < 3600 {
        format!("{}m {}s", secs / 60, secs % 60)
    } else {
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        format!("{h}h {m}m")
    }
}

/// Check if stdout is connected to a terminal (not piped).
fn is_terminal_stdout() -> bool {
    std::io::stdout().is_terminal()
}
