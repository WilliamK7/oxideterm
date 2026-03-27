//! Cross-platform IPC transport layer.
//!
//! - macOS/Linux: Unix Domain Socket at `~/.oxideterm/oxt.sock`
//! - Windows: Named Pipe at `\\.\pipe\OxideTerm-CLI-{username}`

use std::path::PathBuf;
use tokio::io::{AsyncRead, AsyncWrite};

// ═══════════════════════════════════════════════════════════════════════════
// Unix implementation (macOS / Linux)
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(unix)]
mod platform {
    use super::*;
    use tokio::net::{UnixListener, UnixStream};

    /// IPC listener wrapping a Unix Domain Socket.
    pub struct IpcListener(UnixListener);

    /// IPC stream wrapping a Unix Domain Socket connection.
    pub struct IpcStream(pub UnixStream);

    impl IpcListener {
        pub async fn bind() -> Result<Self, std::io::Error> {
            let path = socket_path()?;

            // Ensure parent directory exists
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // Clean up stale socket from previous crash
            if path.exists() {
                // Try connecting to check if another instance is running
                match UnixStream::connect(&path).await {
                    Ok(_) => {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::AddrInUse,
                            "Another OxideTerm instance is already running",
                        ));
                    }
                    Err(_) => {
                        // Stale socket — remove it
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }

            let listener = UnixListener::bind(&path)?;

            // Set socket permissions to 0600 (owner only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
            }

            tracing::debug!("CLI IPC socket bound at {:?}", path);
            Ok(Self(listener))
        }

        pub async fn accept(&self) -> Result<IpcStream, std::io::Error> {
            let (stream, _addr) = self.0.accept().await?;
            Ok(IpcStream(stream))
        }
    }

    impl AsyncRead for IpcStream {
        fn poll_read(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
            buf: &mut tokio::io::ReadBuf<'_>,
        ) -> std::task::Poll<std::io::Result<()>> {
            std::pin::Pin::new(&mut self.0).poll_read(cx, buf)
        }
    }

    impl AsyncWrite for IpcStream {
        fn poll_write(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
            buf: &[u8],
        ) -> std::task::Poll<Result<usize, std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_write(cx, buf)
        }

        fn poll_flush(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_flush(cx)
        }

        fn poll_shutdown(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_shutdown(cx)
        }
    }

    fn socket_path() -> Result<PathBuf, std::io::Error> {
        crate::config::storage::config_dir()
            .map(|dir| dir.join("oxt.sock"))
            .map_err(|e| std::io::Error::other(e.to_string()))
    }

    /// Display string for logging the IPC endpoint.
    pub fn ipc_endpoint_display() -> String {
        socket_path()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "<unknown>".to_string())
    }

    /// Clean up socket file on shutdown.
    pub fn cleanup() {
        if let Ok(path) = socket_path() {
            let _ = std::fs::remove_file(&path);
            tracing::debug!("CLI IPC socket cleaned up: {:?}", path);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Windows implementation (Named Pipe)
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(windows)]
mod platform {
    use super::*;
    use tokio::net::windows::named_pipe::{ClientOptions, ServerOptions};

    /// IPC listener wrapping Windows Named Pipe server.
    pub struct IpcListener {
        pipe_name: String,
    }

    /// IPC stream wrapping a Named Pipe connection.
    pub struct IpcStream(pub tokio::net::windows::named_pipe::NamedPipeServer);

    impl IpcListener {
        pub async fn bind() -> Result<Self, std::io::Error> {
            let pipe_name = pipe_name();

            // Verify no other instance is listening by trying to connect
            match ClientOptions::new().open(&pipe_name) {
                Ok(_) => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::AddrInUse,
                        "Another OxideTerm instance is already running",
                    ));
                }
                Err(_) => {
                    // Good — no one listening, we can create the pipe
                }
            }

            // Create the first pipe instance to verify we can bind
            // TODO(security): Set SECURITY_ATTRIBUTES to restrict access to current user.
            // Default ACLs may allow other users on the system to connect.
            let _server = ServerOptions::new()
                .first_pipe_instance(true)
                .create(&pipe_name)?;

            tracing::debug!("CLI IPC pipe created: {}", pipe_name);
            Ok(Self { pipe_name })
        }

        pub async fn accept(&self) -> Result<IpcStream, std::io::Error> {
            let server = ServerOptions::new()
                .first_pipe_instance(false)
                .create(&self.pipe_name)?;
            server.connect().await?;
            Ok(IpcStream(server))
        }
    }

    impl AsyncRead for IpcStream {
        fn poll_read(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
            buf: &mut tokio::io::ReadBuf<'_>,
        ) -> std::task::Poll<std::io::Result<()>> {
            std::pin::Pin::new(&mut self.0).poll_read(cx, buf)
        }
    }

    impl AsyncWrite for IpcStream {
        fn poll_write(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
            buf: &[u8],
        ) -> std::task::Poll<Result<usize, std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_write(cx, buf)
        }

        fn poll_flush(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_flush(cx)
        }

        fn poll_shutdown(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), std::io::Error>> {
            std::pin::Pin::new(&mut self.0).poll_shutdown(cx)
        }
    }

    fn pipe_name() -> String {
        let username = whoami::username();
        format!(r"\\.\pipe\OxideTerm-CLI-{}", username)
    }

    /// Display string for logging the IPC endpoint.
    pub fn ipc_endpoint_display() -> String {
        pipe_name()
    }

    /// No-op on Windows (named pipes don't leave files).
    pub fn cleanup() {}
}

pub use platform::*;
