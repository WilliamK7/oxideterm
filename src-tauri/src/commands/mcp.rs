//! MCP (Model Context Protocol) Stdio Transport
//!
//! Manages MCP server processes that communicate via stdin/stdout JSON-RPC.
//! Each server is spawned as a child process with configurable command, args, and env.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

/// Per-server I/O handles behind their own mutex so requests to different
/// servers never block each other.
struct McpProcessIo {
    stdin: tokio::process::ChildStdin,
    stdout_reader: BufReader<tokio::process::ChildStdout>,
    next_id: u64,
}

struct McpProcess {
    child: Mutex<Child>,
    io: Mutex<McpProcessIo>,
    stderr_task: JoinHandle<()>,
}

pub struct McpProcessRegistry {
    processes: Mutex<HashMap<String, Arc<McpProcess>>>,
}

impl McpProcessRegistry {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub async fn stop_all(&self) {
        let mut procs = self.processes.lock().await;
        for (id, proc) in procs.drain() {
            tracing::info!("[MCP] Stopping server {}", id);
            proc.stderr_task.abort();
            let _ = proc.child.lock().await.kill().await;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════════════════

/// Spawn an MCP stdio server process. Returns a runtime server ID.
#[tauri::command]
pub async fn mcp_spawn_server(
    state: State<'_, Arc<McpProcessRegistry>>,
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<String, String> {
    let server_id = format!("mcp-{}", uuid::Uuid::new_v4());

    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .envs(&env)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server '{}': {}", command, e))?;

    let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;

    // Log stderr in background — tracked so we can cancel on cleanup
    let stderr_task = if let Some(stderr) = child.stderr.take() {
        let sid = server_id.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => tracing::debug!("[MCP:{}] stderr: {}", sid, line.trim_end()),
                    Err(_) => break,
                }
            }
        })
    } else {
        tokio::spawn(async {})
    };

    let proc = Arc::new(McpProcess {
        child: Mutex::new(child),
        io: Mutex::new(McpProcessIo {
            stdin,
            stdout_reader: BufReader::new(stdout),
            next_id: 1,
        }),
        stderr_task,
    });

    state.processes.lock().await.insert(server_id.clone(), proc);
    tracing::info!("[MCP] Spawned server '{}' as {}", command, server_id);

    Ok(server_id)
}

/// Send a JSON-RPC request to an MCP server and return the result.
/// `params` is a JSON string to avoid Tauri serde issues with generic Value.
#[tauri::command]
pub async fn mcp_send_request(
    state: State<'_, Arc<McpProcessRegistry>>,
    server_id: String,
    method: String,
    params: String,
) -> Result<Value, String> {
    // Clone the Arc so we can release the registry lock immediately
    let proc = {
        let procs = state.processes.lock().await;
        procs
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("MCP server {} not found", server_id))?
    };

    // Lock only the per-server I/O — other servers are unaffected
    let mut io = proc.io.lock().await;

    let request_id = io.next_id;
    io.next_id += 1;

    // Parse params — return error instead of silently falling back to null
    let params_value: Value = serde_json::from_str(&params)
        .map_err(|e| format!("Invalid MCP params JSON: {}", e))?;

    // Build JSON-RPC request
    let request = if method.starts_with("notifications/") {
        // Notifications don't have an ID
        serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params_value,
        })
    } else {
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params_value,
        })
    };

    // Write to stdin
    let request_str = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    io.stdin
        .write_all(request_str.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to MCP server: {}", e))?;
    io.stdin
        .write_all(b"\n")
        .await
        .map_err(|e| format!("Failed to write newline: {}", e))?;
    io.stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush: {}", e))?;

    // For notifications, return immediately
    if method.starts_with("notifications/") {
        return Ok(Value::Null);
    }

    // Read response line from stdout (with timeout)
    let mut response_line = String::new();
    let read_result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        read_next_response(&mut io.stdout_reader, &mut response_line, request_id),
    )
    .await
    .map_err(|_| format!("MCP server {} timed out (30s)", server_id))?;

    read_result?;

    let response: Value = serde_json::from_str(&response_line)
        .map_err(|e| format!("Invalid JSON from MCP server: {} — raw: {}", e, &response_line[..response_line.len().min(200)]))?;

    // Check for error
    if let Some(error) = response.get("error") {
        let msg = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown MCP error");
        return Err(format!("MCP error: {}", msg));
    }

    Ok(response.get("result").cloned().unwrap_or(Value::Null))
}

/// Read lines from stdout until we find a response matching our request ID.
/// Skips notification lines (no "id" field).
async fn read_next_response(
    reader: &mut BufReader<tokio::process::ChildStdout>,
    buf: &mut String,
    expected_id: u64,
) -> Result<(), String> {
    loop {
        buf.clear();
        let n = reader
            .read_line(buf)
            .await
            .map_err(|e| format!("Failed to read from MCP server: {}", e))?;
        if n == 0 {
            return Err("MCP server closed stdout".to_string());
        }

        // Try to parse and check if this is our response
        if let Ok(val) = serde_json::from_str::<Value>(buf.trim()) {
            if let Some(id) = val.get("id").and_then(|v| v.as_u64()) {
                if id == expected_id {
                    return Ok(());
                }
            }
            // It's a notification or different request response — skip
        }
    }
}

/// Close an MCP server process.
#[tauri::command]
pub async fn mcp_close_server(
    state: State<'_, Arc<McpProcessRegistry>>,
    server_id: String,
) -> Result<(), String> {
    let proc = {
        let mut procs = state.processes.lock().await;
        procs.remove(&server_id)
    };
    if let Some(proc) = proc {
        tracing::info!("[MCP] Closing server {}", server_id);
        // Send shutdown notification, wait briefly, then force kill
        {
            let mut io = proc.io.lock().await;
            let shutdown = b"{\"jsonrpc\":\"2.0\",\"method\":\"shutdown\"}\n";
            let _ = io.stdin.write_all(shutdown).await;
            let _ = io.stdin.flush().await;
        }
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            proc.child.lock().await.wait(),
        ).await;
        let _ = proc.child.lock().await.kill().await;
        proc.stderr_task.abort();
    }
    Ok(())
}
