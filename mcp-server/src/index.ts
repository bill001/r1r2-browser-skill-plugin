/**
 * R1R2 浏览器技能 MCP Server
 * 
 * 将 r1r2-bsk CLI 封装为 6 个 browser_* MCP tools，
 * 供 ARCA.CSR.智驱 通过 JSON-RPC 2.0 stdio 协议调用。
 * 
 * Tools:
 *   browser_session   — 会话管理 (start, stop, list)
 *   browser_page      — 页面导航 (navigate, back, forward, reload, wait)
 *   browser_inspect   — 页面观察 (observe, snapshot, html, screenshot, console, network)
 *   browser_interact  — 页面交互 (click, hover, fill, select, press, focus, blur, wheel, scroll-to)
 *   browser_tabs      — 标签管理 (list, create, select, close, borrow, return)
 *   browser_assist    — 辅助操作 (resize, emulate, request-help)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ─── Configuration ──────────────────────────────────────────────────
const BSK_PATH = process.env.R1R2_BSK_PATH || "r1r2-bsk";
const BSK_HOME = process.env.R1R2_BSK_HOME || process.env.BSK_HOME || "";
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Runner ─────────────────────────────────────────────────────────
interface BskResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json?: unknown;
}

async function runBsk(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<BskResult> {
  const env = { ...process.env };
  if (BSK_HOME) {
    env.BSK_HOME = BSK_HOME;
  }

  try {
    const { stdout, stderr } = await execFileAsync(BSK_PATH, [...args, "--json"], {
      timeout: timeoutMs,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      // not JSON, raw text
    }

    return { stdout, stderr, exitCode: 0, json };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || (e.killed ? "timeout" : String(err)),
      exitCode: e.code || 1,
      json: undefined,
    };
  }
}

function formatResult(result: BskResult): string {
  if (result.json !== undefined) {
    return JSON.stringify(result.json, null, 2);
  }
  if (result.stdout) return result.stdout;
  if (result.stderr) return `Error: ${result.stderr}`;
  return `Exit code: ${result.exitCode}`;
}

// ─── Server ─────────────────────────────────────────────────────────
const server = new McpServer({
  name: "r1r2-browserskill",
  version: "0.3.0",
});

// ── Tool 1: browser_session ─────────────────────────────────────────
server.tool(
  "browser_session",
  "Manage browser sessions: start a new Agent Window, stop an existing session, or list active sessions.",
  {
    action: z.enum(["start", "stop", "list"]).describe("Action to perform"),
    session: z.string().optional().describe("Session ID (required for stop)"),
    browser: z.string().optional().describe("Browser instance ID or label"),
    noFocus: z.boolean().optional().describe("Start without focusing the Agent Window"),
  },
  async (params) => {
    const args: string[] = [];
    switch (params.action) {
      case "start":
        args.push("session", "start");
        if (params.browser) args.push("--browser", params.browser);
        if (params.noFocus) args.push("--no-focus");
        break;
      case "stop":
        if (!params.session) return { content: [{ type: "text", text: "Error: session ID required for stop" }] };
        args.push("session", "stop", params.session);
        break;
      case "list":
        args.push("session", "list");
        break;
    }
    const result = await runBsk(args);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ── Tool 2: browser_page ────────────────────────────────────────────
server.tool(
  "browser_page",
  "Navigate the active tab: go to a URL, go back/forward, reload, or wait for page events.",
  {
    action: z.enum(["navigate", "back", "forward", "reload", "wait"]).describe("Navigation action"),
    session: z.string().optional().describe("Session ID"),
    url: z.string().optional().describe("URL to navigate to (required for navigate)"),
    timeout: z.number().optional().describe("Wait timeout in milliseconds"),
    event: z.string().optional().describe("Wait event: load, domcontentloaded, networkidle"),
  },
  async (params) => {
    const args: string[] = [];
    const sessionArg = params.session ? ["--session", params.session] : [];

    switch (params.action) {
      case "navigate":
        if (!params.url) return { content: [{ type: "text", text: "Error: url required for navigate" }] };
        args.push("navigate", params.url, ...sessionArg);
        break;
      case "back":
        args.push("navigate", "back", ...sessionArg);
        break;
      case "forward":
        args.push("navigate", "forward", ...sessionArg);
        break;
      case "reload":
        args.push("navigate", "reload", ...sessionArg);
        break;
      case "wait":
        args.push("wait-for-navigation", ...sessionArg);
        if (params.event) args.push("--event", params.event);
        if (params.timeout) args.push("--timeout", `${params.timeout}ms`);
        break;
    }
    const result = await runBsk(args);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ── Tool 3: browser_inspect ─────────────────────────────────────────
server.tool(
  "browser_inspect",
  "Read page state: semantic observation with @eN refs, accessibility snapshot, raw HTML, screenshot, console logs, or network requests.",
  {
    action: z.enum(["observe", "snapshot", "html", "screenshot", "console", "network"]).describe("Inspection action"),
    session: z.string().optional().describe("Session ID"),
    maxTokens: z.number().optional().describe("Max tokens for observe output"),
    fullPage: z.boolean().optional().describe("Capture full-page screenshot"),
    out: z.string().optional().describe("Output file path for screenshot"),
    ref: z.string().optional().describe("Element ref for targeted screenshot (@eN)"),
  },
  async (params) => {
    const sessionArg = params.session ? ["--session", params.session] : [];
    const args: string[] = [];

    switch (params.action) {
      case "observe":
        args.push("observe", ...sessionArg);
        if (params.maxTokens) args.push("--max-tokens", String(params.maxTokens));
        break;
      case "snapshot":
        args.push("snapshot", ...sessionArg);
        break;
      case "html":
        args.push("get-html", ...sessionArg);
        break;
      case "screenshot":
        args.push("screenshot", ...sessionArg);
        if (params.fullPage) args.push("--full-page");
        if (params.out) args.push("--out", params.out);
        if (params.ref) args.push("--ref", params.ref);
        break;
      case "console":
        args.push("console", ...sessionArg);
        break;
      case "network":
        args.push("network", ...sessionArg);
        break;
    }
    const result = await runBsk(args, params.action === "screenshot" ? 120_000 : DEFAULT_TIMEOUT_MS);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ── Tool 4: browser_interact ────────────────────────────────────────
server.tool(
  "browser_interact",
  "Interact with page elements: click, hover, fill text, select options, press keys, focus/blur, scroll, or wheel.",
  {
    action: z.enum(["click", "hover", "fill", "select", "press", "focus", "blur", "wheel", "scroll-to"]).describe("Interaction action"),
    session: z.string().optional().describe("Session ID"),
    ref: z.string().optional().describe("Element ref (@eN)"),
    value: z.string().optional().describe("Value for fill/select"),
    key: z.string().optional().describe("Key name for press (e.g. Enter, Tab)"),
    deltaY: z.number().optional().describe("Wheel scroll delta in pixels (positive=down, negative=up)"),
    deltaX: z.number().optional().describe("Wheel horizontal scroll delta"),
  },
  async (params) => {
    const sessionArg = params.session ? ["--session", params.session] : [];
    const args: string[] = [];

    switch (params.action) {
      case "click":
        if (!params.ref) return { content: [{ type: "text", text: "Error: ref required for click" }] };
        args.push("click", params.ref, ...sessionArg);
        break;
      case "hover":
        if (!params.ref) return { content: [{ type: "text", text: "Error: ref required for hover" }] };
        args.push("hover", params.ref, ...sessionArg);
        break;
      case "fill":
        if (!params.ref || params.value === undefined) return { content: [{ type: "text", text: "Error: ref and value required for fill" }] };
        args.push("fill", params.ref, "--value", params.value, ...sessionArg);
        break;
      case "select":
        if (!params.ref || params.value === undefined) return { content: [{ type: "text", text: "Error: ref and value required for select" }] };
        args.push("select", params.ref, "--value", params.value, ...sessionArg);
        break;
      case "press":
        if (!params.key) return { content: [{ type: "text", text: "Error: key required for press" }] };
        args.push("press", params.key, ...sessionArg);
        if (params.ref) args.push("--ref", params.ref);
        break;
      case "focus":
        if (!params.ref) return { content: [{ type: "text", text: "Error: ref required for focus" }] };
        args.push("focus", params.ref, ...sessionArg);
        break;
      case "blur":
        if (!params.ref) return { content: [{ type: "text", text: "Error: ref required for blur" }] };
        args.push("blur", params.ref, ...sessionArg);
        break;
      case "wheel":
        args.push("wheel", ...sessionArg);
        if (params.deltaY !== undefined) args.push("--delta-y", String(params.deltaY));
        if (params.deltaX !== undefined) args.push("--delta-x", String(params.deltaX));
        break;
      case "scroll-to":
        if (!params.ref) return { content: [{ type: "text", text: "Error: ref required for scroll-to" }] };
        args.push("scroll-to", params.ref, ...sessionArg);
        break;
    }
    const result = await runBsk(args);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ── Tool 5: browser_tabs ────────────────────────────────────────────
server.tool(
  "browser_tabs",
  "Manage browser tabs: list, create, select, close agent tabs; borrow and return user tabs.",
  {
    action: z.enum(["list", "create", "select", "close", "borrow", "return"]).describe("Tab action"),
    session: z.string().optional().describe("Session ID"),
    tabId: z.string().optional().describe("Tab ID"),
    scope: z.enum(["agent", "user"]).optional().describe("Tab scope for list"),
    url: z.string().optional().describe("URL for create"),
    noActive: z.boolean().optional().describe("Create tab without activating it"),
    timeout: z.string().optional().describe("Borrow confirmation timeout (e.g. 120s)"),
  },
  async (params) => {
    const sessionArg = params.session ? ["--session", params.session] : [];
    const args: string[] = [];

    switch (params.action) {
      case "list":
        args.push("tab", "list", ...sessionArg);
        if (params.scope) args.push("--scope", params.scope);
        break;
      case "create":
        args.push("tab", "create", ...sessionArg);
        if (params.url) args.push("--url", params.url);
        if (params.noActive) args.push("--no-active");
        break;
      case "select":
        if (!params.tabId) return { content: [{ type: "text", text: "Error: tabId required for select" }] };
        args.push("tab", "select", params.tabId, ...sessionArg);
        break;
      case "close":
        if (!params.tabId) return { content: [{ type: "text", text: "Error: tabId required for close" }] };
        args.push("tab", "close", params.tabId, ...sessionArg);
        break;
      case "borrow":
        if (!params.tabId) return { content: [{ type: "text", text: "Error: tabId required for borrow" }] };
        args.push("tab", "borrow", params.tabId, ...sessionArg);
        if (params.timeout) args.push("--timeout", params.timeout);
        break;
      case "return":
        if (!params.tabId) return { content: [{ type: "text", text: "Error: tabId required for return" }] };
        args.push("tab", "return", params.tabId, ...sessionArg);
        break;
    }
    const result = await runBsk(args, params.action === "borrow" ? 180_000 : DEFAULT_TIMEOUT_MS);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ── Tool 6: browser_assist ──────────────────────────────────────────
server.tool(
  "browser_assist",
  "Auxiliary browser operations: resize viewport, emulate device, or request human help for CAPTCHA/login/confirmation.",
  {
    action: z.enum(["resize", "emulate", "request-help"]).describe("Assist action"),
    session: z.string().optional().describe("Session ID"),
    device: z.enum(["iphone-14", "iphone-14-pro-max", "iphone-se", "pixel-7", "galaxy-s23", "ipad-mini", "galaxy-tab-s8"]).optional().describe("Device preset for emulate"),
    off: z.boolean().optional().describe("Turn off emulation"),
    width: z.number().optional().describe("Viewport width for resize"),
    height: z.number().optional().describe("Viewport height for resize"),
    prompt: z.string().optional().describe("Help prompt text for request-help"),
    target: z.string().optional().describe("Element ref (@eN) for request-help"),
  },
  async (params) => {
    const sessionArg = params.session ? ["--session", params.session] : [];
    const args: string[] = [];

    switch (params.action) {
      case "resize":
        args.push("window", "resize", ...sessionArg);
        if (params.width) args.push("--width", String(params.width));
        if (params.height) args.push("--height", String(params.height));
        break;
      case "emulate":
        args.push("emulate", ...sessionArg);
        if (params.device) args.push("--device", params.device);
        if (params.off) args.push("--off");
        break;
      case "request-help":
        args.push("request-help", ...sessionArg);
        if (params.prompt) args.push("--prompt", params.prompt);
        if (params.target) args.push("--target", params.target);
        break;
    }
    const result = await runBsk(args, params.action === "request-help" ? 300_000 : DEFAULT_TIMEOUT_MS);
    return { content: [{ type: "text", text: formatResult(result) }] };
  }
);

// ─── Start ──────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[r1r2-browserskill] MCP Server started (stdio transport)");
  console.error(`[r1r2-browserskill] bsk path: ${BSK_PATH}`);
  console.error(`[r1r2-browserskill] bsk home: ${BSK_HOME || "(default ~/.bsk)"}`);
}

main().catch((err) => {
  console.error("[r1r2-browserskill] Fatal:", err);
  process.exit(1);
});
