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
  McpResource,
  McpResourceContent,
  McpCallToolResult,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerCapabilities,
} from './mcpTypes';

let nextRequestId = 1;

function makeRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: '2.0', id: nextRequestId++, method, params };
}

function makeNotification(method: string, params?: Record<string, unknown>): Omit<JsonRpcRequest, 'id'> & { id?: undefined } {
  return { jsonrpc: '2.0', method, params } as Omit<JsonRpcRequest, 'id'> & { id?: undefined };
}

/**
 * Retrieve the auth token for an MCP server from the OS keychain.
 * Falls back to the legacy `authToken` field on config for migration.
 */
async function getMcpAuthToken(config: { id: string; authToken?: string }): Promise<string | undefined> {
  try {
    const keychainToken = await api.getAiProviderApiKey(`mcp:${config.id}`);
    if (keychainToken) return keychainToken;
  } catch {
    // keychain access failed — fall through to legacy
  }
  if (config.authToken) {
    console.info(`[MCP] Using legacy authToken for ${config.id} — migrate to keychain`);
    return config.authToken;
  }
  return undefined;
}

/**
 * Store an MCP server auth token in the OS keychain.
 */
export async function setMcpAuthToken(serverId: string, token: string): Promise<void> {
  await api.setAiProviderApiKey(`mcp:${serverId}`, token);
}

/**
 * Delete an MCP server auth token from the OS keychain.
 */
export async function deleteMcpAuthToken(serverId: string): Promise<void> {
  await api.deleteAiProviderApiKey(`mcp:${serverId}`);
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

async function sseRequest(baseUrl: string, request: JsonRpcRequest | Record<string, unknown>, authToken?: string): Promise<JsonRpcResponse> {
  const base = validateMcpUrl(baseUrl);
  const url = new URL('/message', base).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers,
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

      // Initialize and capture capabilities
      const initResult = await stdioRequest(runtimeId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'OxideTerm', version: '1.0.0' },
      }) as { capabilities?: McpServerCapabilities } | undefined;

      // Notify initialized
      await stdioRequest(runtimeId, 'notifications/initialized');

      // List tools
      const toolsResult = await stdioRequest(runtimeId, 'tools/list') as { tools?: McpToolSchema[] } | undefined;
      const tools = toolsResult?.tools ?? [];

      // List resources if server advertises the capability
      let resources: McpResource[] = [];
      if (initResult?.capabilities?.resources) {
        const resResult = await stdioRequest(runtimeId, 'resources/list') as { resources?: McpResource[] } | undefined;
        resources = resResult?.resources ?? [];
      }

      return { ...state, status: 'connected', runtimeId, tools, resources, error: undefined };

    } else {
      // SSE transport
      const url = config.url ?? '';
      const token = await getMcpAuthToken(config);

      // Initialize
      const initReq = makeRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'OxideTerm', version: '1.0.0' },
      });
      const initResp = await sseRequest(url, initReq, token);
      const initResult = extractResult(initResp) as { capabilities?: McpServerCapabilities } | undefined;

      // Notify initialized (notification — no id)
      const notifyMsg = makeNotification('notifications/initialized');
      await sseRequest(url, notifyMsg, token);

      // List tools (only if server advertises tools capability)
      let tools: McpToolSchema[] = [];
      if (initResult?.capabilities?.tools) {
        const listReq = makeRequest('tools/list');
        const listResp = await sseRequest(url, listReq, token);
        const listResult = extractResult(listResp) as { tools?: McpToolSchema[] } | undefined;
        tools = listResult?.tools ?? [];
      }

      // List resources (only if server advertises resources capability)
      let resources: McpResource[] = [];
      if (initResult?.capabilities?.resources) {
        const resReq = makeRequest('resources/list');
        const resResp = await sseRequest(url, resReq, token);
        const resResult = extractResult(resResp) as { resources?: McpResource[] } | undefined;
        resources = resResult?.resources ?? [];
      }

      return { ...state, status: 'connected', tools, resources, error: undefined };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[MCP] Failed to connect to ${config.name}:`, message);
    return { ...state, status: 'error', error: message, tools: [], resources: [] };
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
  return { ...state, status: 'disconnected', runtimeId: undefined, tools: [], resources: [], error: undefined };
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
    const token = await getMcpAuthToken(state.config);
    const req = makeRequest('tools/call', params);
    const resp = await sseRequest(state.config.url, req, token);
    return extractResult(resp) as McpCallToolResult;
  }

  throw new Error(`MCP server ${state.config.name} is not connected`);
}

export async function readMcpResource(
  state: McpServerState,
  uri: string,
): Promise<McpResourceContent> {
  const params = { uri };

  if (state.config.transport === 'stdio' && state.runtimeId) {
    const result = await stdioRequest(state.runtimeId, 'resources/read', params);
    const contents = (result as { contents?: McpResourceContent[] })?.contents;
    if (!contents?.length) throw new Error(`Empty resource response for ${uri}`);
    return contents[0];
  } else if (state.config.transport === 'sse' && state.config.url) {
    const token = await getMcpAuthToken(state.config);
    const req = makeRequest('resources/read', params);
    const resp = await sseRequest(state.config.url, req, token);
    const result = extractResult(resp) as { contents?: McpResourceContent[] } | undefined;
    const contents = result?.contents;
    if (!contents?.length) throw new Error(`Empty resource response for ${uri}`);
    return contents[0];
  }

  throw new Error(`MCP server ${state.config.name} is not connected`);
}

export async function refreshMcpTools(state: McpServerState): Promise<McpToolSchema[]> {
  if (state.status !== 'connected') return [];

  if (state.config.transport === 'stdio' && state.runtimeId) {
    const result = await stdioRequest(state.runtimeId, 'tools/list') as { tools?: McpToolSchema[] } | undefined;
    return result?.tools ?? [];
  } else if (state.config.transport === 'sse' && state.config.url) {
    const token = await getMcpAuthToken(state.config);
    const req = makeRequest('tools/list');
    const resp = await sseRequest(state.config.url, req, token);
    const result = extractResult(resp) as { tools?: McpToolSchema[] } | undefined;
    return result?.tools ?? [];
  }

  return [];
}
