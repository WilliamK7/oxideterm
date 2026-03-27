//! IPC connection to the OxideTerm GUI process.
//!
//! - macOS/Linux: Unix Domain Socket at `~/.oxideterm/oxt.sock`
//! - Windows: Named Pipe at `\\.\pipe\OxideTerm-CLI-{username}`

use crate::protocol;
use std::io::{BufRead, BufReader, Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// A connection to the running OxideTerm GUI.
pub struct IpcConnection {
    #[cfg(unix)]
    stream: std::os::unix::net::UnixStream,
    #[cfg(windows)]
    stream: PipeStream,
}

#[cfg(windows)]
struct PipeStream {
    handle: std::fs::File,
}

impl IpcConnection {
    /// Connect to the running OxideTerm GUI.
    pub fn connect(custom_path: Option<&str>, timeout_ms: u64) -> Result<Self, String> {
        let timeout = Duration::from_millis(timeout_ms);

        #[cfg(unix)]
        {
            let path = if let Some(p) = custom_path {
                std::path::PathBuf::from(p)
            } else if let Ok(p) = std::env::var("OXIDETERM_SOCK") {
                std::path::PathBuf::from(p)
            } else {
                dirs::home_dir()
                    .ok_or("Cannot determine home directory")?
                    .join(".oxideterm")
                    .join("oxt.sock")
            };

            if !path.exists() {
                return Err(format!(
                    "OxideTerm is not running (socket not found: {})\n\
                     Start OxideTerm first, or use 'oxt list connections --offline' for saved data.",
                    path.display()
                ));
            }

            let stream = std::os::unix::net::UnixStream::connect(&path)
                .map_err(|e| format!("Failed to connect to OxideTerm: {e}"))?;
            stream
                .set_read_timeout(Some(timeout))
                .map_err(|e| format!("Failed to set timeout: {e}"))?;
            stream
                .set_write_timeout(Some(timeout))
                .map_err(|e| format!("Failed to set timeout: {e}"))?;

            Ok(Self { stream })
        }

        #[cfg(windows)]
        {
            let pipe_name = if let Some(p) = custom_path {
                p.to_string()
            } else if let Ok(p) = std::env::var("OXIDETERM_PIPE") {
                p
            } else {
                format!(r"\\.\pipe\OxideTerm-CLI-{}", whoami::username())
            };

            use std::fs::OpenOptions;
            let handle = OpenOptions::new()
                .read(true)
                .write(true)
                .open(&pipe_name)
                .map_err(|e| {
                    format!(
                        "OxideTerm is not running (pipe not found: {pipe_name})\n\
                         Start OxideTerm first. Error: {e}"
                    )
                })?;

            Ok(Self {
                stream: PipeStream { handle },
            })
        }
    }

    /// Send a JSON-RPC request and wait for the response.
    pub fn call(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = protocol::Request::new(id, method, params);

        let mut buf = serde_json::to_vec(&req).map_err(|e| format!("Serialize error: {e}"))?;
        buf.push(b'\n');

        self.write_all(&buf)?;
        self.flush()?;

        let line = self.read_line()?;
        let resp: protocol::Response =
            serde_json::from_str(&line).map_err(|e| format!("Invalid response: {e}"))?;

        if let Some(err) = resp.error {
            return Err(format!("[{}] {}", err.code, err.message));
        }

        resp.result
            .ok_or_else(|| "Empty response from server".to_string())
    }

    fn write_all(&mut self, buf: &[u8]) -> Result<(), String> {
        #[cfg(unix)]
        {
            self.stream
                .write_all(buf)
                .map_err(|e| format!("Write error: {e}"))
        }
        #[cfg(windows)]
        {
            self.stream
                .handle
                .write_all(buf)
                .map_err(|e| format!("Write error: {e}"))
        }
    }

    fn flush(&mut self) -> Result<(), String> {
        #[cfg(unix)]
        {
            self.stream
                .flush()
                .map_err(|e| format!("Flush error: {e}"))
        }
        #[cfg(windows)]
        {
            self.stream
                .handle
                .flush()
                .map_err(|e| format!("Flush error: {e}"))
        }
    }

    fn read_line(&mut self) -> Result<String, String> {
        let mut line = String::new();
        const MAX_RESPONSE: u64 = 4_194_304; // 4 MB limit
        #[cfg(unix)]
        {
            let mut reader = BufReader::new((&self.stream).take(MAX_RESPONSE));
            reader
                .read_line(&mut line)
                .map_err(|e| format!("Read error (is OxideTerm running?): {e}"))?;
        }
        #[cfg(windows)]
        {
            let mut reader = BufReader::new((&self.stream.handle).take(MAX_RESPONSE));
            reader
                .read_line(&mut line)
                .map_err(|e| format!("Read error (is OxideTerm running?): {e}"))?;
        }
        Ok(line)
    }
}
