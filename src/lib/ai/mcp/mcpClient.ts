/**
 * MCP Client — Handles communication with MCP servers
 * 
 * Supports two transports:
 * - SSE (HTTP): Direct HTTP requests from frontend
 * - Stdio: JSON-RPC over stdin/stdout, managed by Rust backend
 */

import { api } from '../../api';
import type {
  McpServerState,
  McpToolSchema,
  McpCallToolResult,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerCapabilities,
} from './mcpTypes';

let nextRequestId = 1;

function makeRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: '2.0', id: nextRequestId++, method, params };
}

// ═══════════════════════════════════════════════════════════════════════════
// SSE Transport
// ═══════════════════════════════════════════════════════════════════════════

function validateMcpUrl(urlStr: string): URL {
  const parsed = new URL(urlStr);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('MCP SSE only supports http/https URLs');
  }
  return parsed;
}

async function sseRequest(baseUrl: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const base = validateMcpUrl(baseUrl);
  const url = new URL('/message', base).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`MCP SSE request failed: ${resp.status} ${resp.statusText}`);
    }
    return resp.json() as Promise<JsonRpcResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Stdio Transport (via Rust backend)
// ═══════════════════════════════════════════════════════════════════════════

async function stdioRequest(runtimeId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  return api.mcpSendRequest(runtimeId, method, params ?? {});
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP Client
// ═══════════════════════════════════════════════════════════════════════════

function extractResult(response: JsonRpcResponse): unknown {
  if (response.error) {
    throw new Error(`MCP error ${response.error.code}: ${response.error.message}`);
  }
  return response.result;
}

export async function connectMcpServer(state: McpServerState): Promise<McpServerState> {
  const { config } = state;

  try {
    if (config.transport === 'stdio') {
      // Spawn process via Rust backend
      const runtimeId = await api.mcpSpawnServer(
        config.command ?? '',
        config.args ?? [],
        config.env ?? {},
      );

      // Initialize
      await stdioRequest(runtimeId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'OxideTerm', version: '1.0.0' },
      });

      // Notify initialized
      await stdioRequest(runtimeId, 'notifications/initialized');

      // List tools
      const toolsResult = await stdioRequest(runtimeId, 'tools/list') as { tools?: McpToolSchema[] } | undefined;
      const tools = toolsResult?.tools ?? [];

      return { ...state, status: 'connected', runtimeId, tools, error: undefined };

    } else {
      // SSE transport
      const url = config.url ?? '';

      // Initialize
      const initReq = makeRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'OxideTerm', version: '1.0.0' },
      });
      const initResp = await sseRequest(url, initReq);
      const initResult = extractResult(initResp) as { capabilities?: McpServerCapabilities } | undefined;

      // Notify initialized
      const notifyReq = makeRequest('notifications/initialized');
      await sseRequest(url, notifyReq);

      // List tools (only if server advertises tools capability)
      let tools: McpToolSchema[] = [];
      if (initResult?.capabilities?.tools) {
        const listReq = makeRequest('tools/list');
        const listResp = await sseRequest(url, listReq);
        const listResult = extractResult(listResp) as { tools?: McpToolSchema[] } | undefined;
        tools = listResult?.tools ?? [];
      }

      return { ...state, status: 'connected', tools, error: undefined };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[MCP] Failed to connect to ${config.name}:`, message);
    return { ...state, status: 'error', error: message, tools: [] };
  }
}

export async function disconnectMcpServer(state: McpServerState): Promise<McpServerState> {
  try {
    if (state.runtimeId) {
      await api.mcpCloseServer(state.runtimeId);
    }
  } catch (e) {
    console.warn(`[MCP] Error disconnecting ${state.config.name}:`, e);
  }
  return { ...state, status: 'disconnected', runtimeId: undefined, tools: [], error: undefined };
}

export async function callMcpTool(
  state: McpServerState,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallToolResult> {
  const params = { name: toolName, arguments: args };

  if (state.config.transport === 'stdio' && state.runtimeId) {
    const result = await stdioRequest(state.runtimeId, 'tools/call', params);
    return result as McpCallToolResult;
  } else if (state.config.transport === 'sse' && state.config.url) {
    const req = makeRequest('tools/call', params);
    const resp = await sseRequest(state.config.url, req);
    return extractResult(resp) as McpCallToolResult;
  }

  throw new Error(`MCP server ${state.config.name} is not connected`);
}

export async function refreshMcpTools(state: McpServerState): Promise<McpToolSchema[]> {
  if (state.status !== 'connected') return [];

  if (state.config.transport === 'stdio' && state.runtimeId) {
    const result = await stdioRequest(state.runtimeId, 'tools/list') as { tools?: McpToolSchema[] } | undefined;
    return result?.tools ?? [];
  } else if (state.config.transport === 'sse' && state.config.url) {
    const req = makeRequest('tools/list');
    const resp = await sseRequest(state.config.url, req);
    const result = extractResult(resp) as { tools?: McpToolSchema[] } | undefined;
    return result?.tools ?? [];
  }

  return [];
}
