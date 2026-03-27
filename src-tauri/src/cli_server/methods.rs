//! RPC method implementations for CLI server.
//!
//! Each method receives JSON params and an AppHandle,
//! extracts the needed state via `app.state()`, and
//! returns a JSON value or error tuple.

use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Manager;

use super::protocol;
use crate::bridge::BridgeManager;
use crate::commands::config::ConfigState;
use crate::commands::forwarding::ForwardingRegistry;
use crate::commands::{HealthRegistry, ProfilerRegistry};
use crate::session::SessionRegistry;
use crate::sftp::session::SftpRegistry;
use crate::ssh::SshConnectionRegistry;

/// Dispatch a JSON-RPC method call to the appropriate handler.
pub async fn dispatch(
    method: &str,
    params: Value,
    app: &tauri::AppHandle,
) -> Result<Value, (i32, String)> {
    match method {
        "status" => status(app).await,
        "list_saved_connections" => list_saved_connections(app).await,
        "list_sessions" => list_sessions(app).await,
        "list_active_connections" => list_active_connections(app).await,
        "list_forwards" => list_forwards(app, params).await,
        "health" => health(app, params).await,
        "disconnect" => disconnect(app, params).await,
        "ping" => Ok(json!({ "pong": true })),
        _ => Err((
            protocol::ERR_METHOD_NOT_FOUND,
            format!("Method not found: {method}"),
        )),
    }
}

/// Return application status summary.
async fn status(app: &tauri::AppHandle) -> Result<Value, (i32, String)> {
    let version = env!("CARGO_PKG_VERSION");

    let session_count = app
        .try_state::<Arc<SessionRegistry>>()
        .map(|r| r.list().len())
        .unwrap_or(0);

    let ssh_count = if let Some(registry) = app.try_state::<Arc<SshConnectionRegistry>>() {
        registry.inner().list_connections().await.len()
    } else {
        0
    };

    #[cfg(feature = "local-terminal")]
    let local_count = if let Some(s) = app.try_state::<Arc<crate::commands::local::LocalTerminalState>>() {
        s.registry.list_sessions().await.len()
    } else {
        0
    };
    #[cfg(not(feature = "local-terminal"))]
    let local_count = 0usize;

    Ok(json!({
        "version": version,
        "sessions": session_count,
        "connections": {
            "ssh": ssh_count,
            "local": local_count,
        },
        "pid": std::process::id(),
    }))
}

/// List saved connection configurations (from connections.json).
async fn list_saved_connections(app: &tauri::AppHandle) -> Result<Value, (i32, String)> {
    let config_state = app
        .try_state::<Arc<ConfigState>>()
        .ok_or((protocol::ERR_INTERNAL, "Config not initialized".to_string()))?;

    let config = config_state.inner().get_config_snapshot();
    let connections: Vec<Value> = config
        .connections
        .iter()
        .map(|conn| {
            let (auth_type, key_path) = match &conn.auth {
                crate::config::SavedAuth::Password { .. } => ("password", None),
                crate::config::SavedAuth::Key { key_path, .. } => {
                    ("key", Some(key_path.as_str()))
                }
                crate::config::SavedAuth::Certificate { key_path, .. } => {
                    ("certificate", Some(key_path.as_str()))
                }
                crate::config::SavedAuth::Agent => ("agent", None),
            };
            json!({
                "id": conn.id,
                "name": conn.name,
                "host": conn.host,
                "port": conn.port,
                "username": conn.username,
                "auth_type": auth_type,
                "key_path": key_path,
                "group": conn.group,
            })
        })
        .collect();

    Ok(json!(connections))
}

/// List active SSH sessions.
async fn list_sessions(app: &tauri::AppHandle) -> Result<Value, (i32, String)> {
    let registry = app
        .try_state::<Arc<SessionRegistry>>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "Session registry not initialized".to_string(),
        ))?;

    let sessions: Vec<Value> = registry
        .list()
        .iter()
        .map(|s| {
            json!({
                "id": s.id,
                "name": s.name,
                "host": s.host,
                "port": s.port,
                "username": s.username,
                "state": format!("{:?}", s.state),
                "uptime_secs": s.uptime_secs,
                "auth_type": s.auth_type,
                "connection_id": s.connection_id,
            })
        })
        .collect();

    Ok(json!(sessions))
}

/// List active SSH connections in the pool.
async fn list_active_connections(app: &tauri::AppHandle) -> Result<Value, (i32, String)> {
    let registry = app
        .try_state::<Arc<SshConnectionRegistry>>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "SSH connection registry not initialized".to_string(),
        ))?;

    let connections = registry.inner().list_connections().await;
    let result: Vec<Value> = connections
        .iter()
        .map(|c| serde_json::to_value(c).unwrap_or(json!(null)))
        .collect();

    Ok(json!(result))
}

/// List port forwards, optionally filtered by session_id.
async fn list_forwards(app: &tauri::AppHandle, params: Value) -> Result<Value, (i32, String)> {
    let forwarding_registry = app
        .try_state::<Arc<ForwardingRegistry>>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "Forwarding registry not initialized".to_string(),
        ))?;

    let session_registry = app
        .try_state::<Arc<SessionRegistry>>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "Session registry not initialized".to_string(),
        ))?;

    let session_filter = params
        .get("session_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let session_ids: Vec<String> = if let Some(sid) = session_filter {
        vec![sid]
    } else {
        session_registry.list().iter().map(|s| s.id.clone()).collect()
    };

    let mut all_forwards = Vec::new();
    for sid in &session_ids {
        if let Some(manager) = forwarding_registry.get(sid).await {
            let forwards = manager.list_forwards().await;
            for rule in forwards {
                all_forwards.push(json!({
                    "session_id": sid,
                    "id": rule.id,
                    "forward_type": format!("{:?}", rule.forward_type).to_lowercase(),
                    "bind_address": rule.bind_address,
                    "bind_port": rule.bind_port,
                    "target_host": rule.target_host,
                    "target_port": rule.target_port,
                    "status": format!("{:?}", rule.status).to_lowercase(),
                    "description": rule.description,
                }));
            }
        }
    }

    Ok(json!(all_forwards))
}

/// Get health status for one or all sessions.
async fn health(app: &tauri::AppHandle, params: Value) -> Result<Value, (i32, String)> {
    let health_registry = app
        .try_state::<HealthRegistry>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "Health registry not initialized".to_string(),
        ))?;

    if let Some(session_id) = params.get("session_id").and_then(|v| v.as_str()) {
        // Single session health
        let tracker = health_registry
            .get(session_id)
            .ok_or((
                protocol::ERR_INVALID_PARAMS,
                format!("No health tracker for session: {session_id}"),
            ))?;

        let metrics = tracker.metrics().await;
        let check =
            crate::session::QuickHealthCheck::from_metrics(session_id.to_string(), &metrics);
        serde_json::to_value(&check).map_err(|e| (protocol::ERR_INTERNAL, e.to_string()))
    } else {
        // All sessions health
        let session_ids = health_registry.session_ids();
        let mut results = serde_json::Map::new();

        for session_id in session_ids {
            if let Some(tracker) = health_registry.get(&session_id) {
                if tracker.is_active() {
                    let metrics = tracker.metrics().await;
                    let check = crate::session::QuickHealthCheck::from_metrics(
                        session_id.clone(),
                        &metrics,
                    );
                    if let Ok(val) = serde_json::to_value(&check) {
                        results.insert(session_id, val);
                    }
                }
            }
        }

        Ok(Value::Object(results))
    }
}

/// Disconnect a session by ID or name.
async fn disconnect(app: &tauri::AppHandle, params: Value) -> Result<Value, (i32, String)> {
    let target = params
        .get("target")
        .and_then(|v| v.as_str())
        .ok_or((
            protocol::ERR_INVALID_PARAMS,
            "Missing required parameter: target".to_string(),
        ))?;

    let registry = app
        .try_state::<Arc<SessionRegistry>>()
        .ok_or((
            protocol::ERR_INTERNAL,
            "Session registry not initialized".to_string(),
        ))?;

    // Resolve target: try as session ID first, then match by name
    let session_id = {
        let sessions = registry.list();
        if sessions.iter().any(|s| s.id == target) {
            target.to_string()
        } else if let Some(s) = sessions.iter().find(|s| s.name == target) {
            s.id.clone()
        } else {
            return Err((
                protocol::ERR_INVALID_PARAMS,
                format!("Session not found: {target}"),
            ));
        }
    };

    // Persist buffer before disconnect
    if let Err(e) = registry.persist_session_with_buffer(&session_id).await {
        tracing::warn!("Failed to persist session buffer before CLI disconnect: {e}");
    }

    // Stop and remove all port forwards for this session
    if let Some(fwd_registry) = app.try_state::<Arc<ForwardingRegistry>>() {
        fwd_registry.remove(&session_id).await;
    }

    // Close session via registry
    registry
        .close_session(&session_id)
        .await
        .map_err(|e| (protocol::ERR_INTERNAL, e))?;

    // Complete disconnection
    let _ = registry.disconnect_complete(&session_id, true);

    // Clean up bridge manager
    if let Some(bridge_manager) = app.try_state::<BridgeManager>() {
        bridge_manager.unregister(&session_id);
    }

    // Clean up SFTP cache
    if let Some(sftp_registry) = app.try_state::<Arc<SftpRegistry>>() {
        sftp_registry.remove(&session_id);
    }

    // Clean up health tracker and profiler
    if let Some(health_reg) = app.try_state::<HealthRegistry>() {
        health_reg.remove(&session_id);
    }
    if let Some(profiler_reg) = app.try_state::<ProfilerRegistry>() {
        profiler_reg.remove(&session_id);
    }

    // Release connection from pool
    if let Some(conn_registry) = app.try_state::<Arc<SshConnectionRegistry>>() {
        if let Err(e) = conn_registry.release(&session_id).await {
            tracing::warn!("Failed to release connection from pool: {e}");
        }
    }

    Ok(json!({
        "success": true,
        "session_id": session_id,
    }))
}
