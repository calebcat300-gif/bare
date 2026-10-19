import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import { Clickable, useMouse } from "ink-use-mouse";
import HoneyTitle from "./HoneyTitle";
import HoneyScrollbar from "./HoneyScrollbar";
import type { Message } from "./types";
import { BARE_MODEL, runAgentTurn, SYSTEM_MESSAGE } from "./core/agent/openai";
import type { AgentEvent, AgentMessage } from "./core/agent/openai";
import type { ApprovalRequest } from "./core/agent/tools";

// The same honey-and-roasted-amber colors as our animated title.
const theme = {
  honey: "#FFC12E",
  heading: "#FFDC57",
  highlight: "#FFE889",
  codeAccent: "#E99C1B",
  text: "#EEE8DF",
  userText: "#FFF0D5",
  codeText: "#F9E2B9",
  muted: "#B0A08A",
  dim: "#84735D",
  quote: "#D6B783",
  border: "#75542D",
  userBackground: "#302419",
  codeBackground: "#211C16",
};

type ChatMessage = {
  id: number;
  role: Message["role"];
  content: string;
  kind?: "tool" | "thinking";
  toolId?: number;
  detail?: string;
  toolName?: string;
  toolStatus?: "running" | "done" | "error" | "denied";
};

type RowKind = "user" | "userPad" | "text" | "heading" | "list" | "quote" | "code" | "codeLabel" | "empty" | "gap" | "activity" | "activityDetail" | "diffAdd" | "diffRemove";
type Row = { key: string; kind: RowKind; text: string; ownerId?: number };

// Strip terminal control sequences from model/tool text before rendering.
function safeText(input: string): string {
  return input
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}

function wrapText(input: string, maxWidth: number): string[] {
  const width = Math.max(8, maxWidth);
  const words = input.replace(/\t/g, "  ").split(/\s+/);
  const output: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    if (current && current.length + 1 + word.length > width) {
      output.push(current);
      current = "";
    }
    if (word.length > width) {
      let remainder = word;
      while (remainder.length > width) {
        output.push(remainder.slice(0, width));
        remainder = remainder.slice(width);
      }
      current = remainder;
    } else {
      current += (current ? " " : "") + word;
    }
  }
  if (current || output.length === 0) output.push(current || " ");
  return output;
}

function inlineText(value: string): React.ReactNode {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Text key={index} bold color={theme.highlight}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <Text key={index} color={theme.codeAccent}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <Text key={index} italic>{part.slice(1, -1)}</Text>;
    }
    return part;
  });
}

// Turn messages into one-line render rows, so PageUp/PageDown works.
function buildRows(messages: ChatMessage[], width: number, expanded: ReadonlySet<number>): Row[] {
  const rows: Row[] = [];
  for (const message of messages) {
    if (!message.content.trim() && !message.kind) continue;
    if (rows.length > 0) rows.push({ key: `${message.id}:gap`, kind: "gap", text: "" });
    let index = 0;
    const push = (kind: RowKind, text: string, ownerId?: number) => rows.push({ key: `${message.id}:${index++}`, kind, text, ownerId });

    if (message.kind === "tool" || message.kind === "thinking") {
      const open = expanded.has(message.id);
      const symbol = open ? "▾" : "▸";
      const state = message.kind === "thinking"
        ? (message.toolStatus === "done" ? "done" : "live")
        : (message.toolStatus || "running");
      const label = message.kind === "thinking" ? "Thinking" : `${message.toolName}: ${message.content}`;
      const heading = `${symbol} [${message.id}] ${label}  ·  ${state}`;
      for (const line of wrapText(heading, width - 2)) push("activity", line, message.id);
      if (open) {
        const details = safeText(message.kind === "thinking" ? message.content : message.detail || "Waiting for output…")
          .slice(0, 12000);
        for (const raw of details.split(/\r?\n/)) {
          const kind: RowKind = raw.startsWith("+ ") ? "diffAdd"
            : raw.startsWith("- ") ? "diffRemove" : "activityDetail";
          // Preserve original indentation for code and diffs.
          const max = Math.max(8, width - 5);
          for (let start = 0; start < Math.max(1, raw.length); start += max) {
            push(kind, raw.slice(start, start + max) || " ");
          }
        }
        if (message.kind === "tool" && message.detail && message.detail.length > 12000) {
          push("activityDetail", "… preview truncated");
        }
      }
      continue;
    }
    if (message.role === "user") {
      push("userPad", " ");
      for (const paragraph of safeText(message.content).split(/\r?\n/)) {
        for (const line of wrapText(paragraph, width - 4)) push("user", line);
      }
      push("userPad", " ");
      continue;
    }

    let inCode = false;
    for (const raw of safeText(message.content).split(/\r?\n/)) {
      const fence = raw.match(/^\s*```\s*(\w*)/);
      if (fence) {
        inCode = !inCode;
        if (inCode) push("codeLabel", fence[1] || "code");
        continue;
      }
      if (inCode) {
        const codeLine = raw.replace(/\t/g, "  ");
        for (let x = 0; x < Math.max(1, codeLine.length); x += Math.max(8, width - 4)) {
          push("code", codeLine.slice(x, x + Math.max(8, width - 4)) || " ");
        }
        continue;
      }
      if (!raw.trim()) { push("empty", " "); continue; }
      const heading = raw.match(/^#{1,3}\s+(.+)$/);
      const bullet = raw.match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
      const quote = raw.match(/^>\s?(.*)$/);
      const kind: RowKind = heading ? "heading" : bullet ? "list" : quote ? "quote" : "text";
      const value = heading ? heading[1] : bullet ? `• ${bullet[2]}` : quote ? `│ ${quote[1]}` : raw;
      for (const line of wrapText(value, width - 2)) push(kind, line);
    }
  }
  return rows;
}

function TranscriptLine({ row, width, onToggle }: { row: Row; width: number; onToggle: (id: number) => void }) {
  if (row.kind === "gap" || row.kind === "empty") return <Box height={1} />;
  if (row.kind === "user" || row.kind === "userPad") {
    return <Box width={width} backgroundColor={theme.userBackground} paddingX={2}>
      <Text color={theme.userText}>{row.text}</Text>
    </Box>;
  }
  if (row.kind === "code" || row.kind === "codeLabel") {
    return <Box width={width} backgroundColor={theme.codeBackground} paddingX={2}>
      <Text color={row.kind === "codeLabel" ? theme.codeAccent : theme.codeText}>{row.text}</Text>
    </Box>;
  }
  if (row.kind === "activity") {
    return <Clickable onClick={() => row.ownerId !== undefined && onToggle(row.ownerId)}>
      <Box width={width} paddingX={1}>
        <Text color={theme.codeAccent} wrap="truncate-end">{row.text}</Text>
      </Box>
    </Clickable>;
  }
  if (row.kind === "activityDetail" || row.kind === "diffAdd" || row.kind === "diffRemove") {
    return <Box width={width} backgroundColor={theme.codeBackground} paddingX={2}>
      <Text color={row.kind === "diffAdd" ? "#A5C990" : row.kind === "diffRemove" ? "#DA948A" : theme.muted}
        wrap="truncate-end">{row.text}</Text>
    </Box>;
  }
  return <Box width={width} paddingX={1}>
    <Text color={row.kind === "heading" ? theme.heading : row.kind === "quote" ? theme.quote : theme.text}
      bold={row.kind === "heading"} wrap="truncate-end">{inlineText(row.text)}</Text>
  </Box>;
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default function Chat() {
  const { stdout } = useStdout();
  const mouse = useMouse();
  const width = Math.max(16, Math.min(104, stdout.columns - 4));
  const height = Math.max(10, stdout.rows - 3);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [scroll, setScroll] = useState(0);
  const [honeyFrame, setHoneyFrame] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef(0);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [tokens, setTokens] = useState({ input: 0, output: 0 });

  const nextId = useRef(0);
  const activeAssistantId = useRef<number | null>(null);
  const activeThinkingId = useRef<number | null>(null);
  const history = useRef<AgentMessage[]>([SYSTEM_MESSAGE]);
  const controller = useRef<AbortController | null>(null);
  const approvalResolve = useRef<((approved: boolean) => void) | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      setSpinnerFrame(frame => (frame + 1) % SPINNER.length);
      setElapsedSeconds((Date.now() - startedAt.current) / 1000);
    }, 85);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => () => {
    controller.current?.abort();
    approvalResolve.current?.(false);
  }, []);

  const isWelcome = messages.length === 0;
  const viewportHeight = Math.max(3, height - (approval ? 10 : 7));
  const transcriptWidth = width - 2; // one blank column + one honey scrollbar column
  const lines = useMemo(() => buildRows(messages, transcriptWidth, expanded), [messages, transcriptWidth, expanded]);
  const maxScroll = Math.max(0, lines.length - viewportHeight);
  const offset = Math.min(scroll, maxScroll);
  const end = lines.length - offset;
  const visibleLines = lines.slice(Math.max(0, end - viewportHeight), end);

  const hasScrollableHistory = maxScroll > 0;
  useEffect(() => {
    if (!hasScrollableHistory) return;
    const timer = setInterval(() => setHoneyFrame(previous => previous + 1), 140);
    return () => clearInterval(timer);
  }, [hasScrollableHistory]);


  // The mouse wheel scrolls through transcript lines, not terminal history.
  // 0 = newest, higher values = older. The honey bar already reads this state.
  useEffect(() => {
    if (maxScroll <= 0) return;

    const step = Math.max(8, Math.ceil(maxScroll / 30));

    if (mouse.type === "scroll-up") {
      setScroll(previous =>
        Math.min(maxScroll, previous + step)
      );
    } else if (mouse.type === "scroll-down") {
      setScroll(previous =>
        Math.max(0, previous - step)
      );
    }
  }, [mouse]);

  useInput((_input, key) => {
    if (key.pageUp) setScroll(prev => Math.min(maxScroll, prev + viewportHeight - 1));
    if (key.pageDown) setScroll(prev => Math.max(0, prev - viewportHeight + 1));
    if (key.escape && running.current) stopTurn();
  });

  function toggleExpanded(id: number) {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopTurn() {
    approvalResolve.current?.(false);
    approvalResolve.current = null;
    setApproval(null);
    controller.current?.abort();
    setStatus("Stopping");
  }

  function updateFromAgent(event: AgentEvent) {
    switch (event.type) {
      case "assistant_start": {
        if (activeThinkingId.current !== null) {
          const oldId = activeThinkingId.current;
          setMessages(prev => prev.map(m => m.id === oldId ? { ...m, toolStatus: "done" } : m));
        }
        // Delay inserting the answer until there is real text. Thinking can
        // then appear before the answer, even if it streams first.
        activeAssistantId.current = ++nextId.current;
        activeThinkingId.current = null;
        break;
      }
      case "thinking": {
        if (activeThinkingId.current === null) {
          const id = ++nextId.current;
          activeThinkingId.current = id;
          setMessages(prev => [...prev, {
            id, role: "assistant", kind: "thinking", content: event.delta, toolStatus: "running"
          }]);
          // Show live reasoning; the user may close the section.
          setExpanded(prev => new Set(prev).add(id));
        } else {
          const id = activeThinkingId.current;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + event.delta } : m));
        }
        break;
      }
      case "text": {
        const id = activeAssistantId.current;
        if (id === null) break;
        setMessages(prev => prev.some(m => m.id === id)
          ? prev.map(message => message.id === id
              ? { ...message, content: message.content + event.delta }
              : message)
          : [...prev, { id, role: "assistant", content: event.delta }]);
        if (activeThinkingId.current !== null) {
          const thoughtId = activeThinkingId.current;
          setMessages(prev => prev.map(m => m.id === thoughtId ? { ...m, toolStatus: "done" } : m));
        }
        break;
      }
      case "status":
        setStatus(event.label);
        break;
      case "tool_start": {
        if (activeThinkingId.current !== null) {
          const thoughtId = activeThinkingId.current;
          setMessages(prev => prev.map(m => m.id === thoughtId ? { ...m, toolStatus: "done" } : m));
        }
        // Also works for repeated calls to the same tool name.
        const id = ++nextId.current;
        setMessages(prev => [...prev, {
          id, role: "assistant", content: event.summary, kind: "tool",
          toolName: event.name, toolId: event.id, toolStatus: "running",
          detail: event.detail,
        }]);
        break;
      }
      case "tool_end": {
        setMessages(prev => prev.map(m => m.kind === "tool" && m.toolId === event.id && m.toolStatus === "running"
          ? { ...m, toolStatus: event.status, detail: `${m.detail || ""}\n\nResult:\n${event.output}` }
          : m));
        break;
      }
      case "stats":
        setTokens(prev => ({ input: prev.input + event.promptTokens, output: prev.output + event.responseTokens }));
        break;
    }
  }

  async function sendPrompt(content: string) {
    const id = ++nextId.current;
    setMessages(prev => [...prev, { id, role: "user", content }]);
    setScroll(0);
    setNotice("");
    setStatus("Connecting");
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    setBusy(true);
    running.current = true;
    const abort = new AbortController();
    controller.current = abort;

    try {
      const result = await runAgentTurn({
        history: history.current,
        prompt: content,
        root: process.cwd(),
        signal: abort.signal,
        onEvent: updateFromAgent,
        approve: request => new Promise(resolve => {
          approvalResolve.current = resolve;
          setApproval(request);
          setStatus("Waiting for approval");
        }),
      });
      history.current = result;
      setStatus("");
    } catch (error) {
      const message = (error as Error).message;
      setNotice(abort.signal.aborted ? "Request stopped" : `Model error: ${message.slice(0, 140)}`);
      setStatus("");
      if (!abort.signal.aborted) {
        const assistantId = activeAssistantId.current;
        setMessages(prev => prev.map(m => m.id === assistantId && !m.content.trim()
          ? { ...m, content: `Could not reach the model. ${message}\n\nCheck the GX10 API and run: bash scripts/run-ascent.sh` }
          : m));
      }
    } finally {
      if (activeThinkingId.current !== null) {
        const thoughtId = activeThinkingId.current;
        setMessages(prev => prev.map(m => m.id === thoughtId ? { ...m, toolStatus: "done" } : m));
      }
      approvalResolve.current = null;
      setApproval(null);
      controller.current = null;
      running.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(value: string) {
    const content = value.trim();
    if (!content) return;
    setInput("");

    if (content.startsWith("/inspect ")) {
      const id = Number(content.slice(9).trim());
      if (Number.isInteger(id) && messages.some(m => m.id === id && m.kind)) {
        toggleExpanded(id);
        setNotice(`Toggled activity ${id}`);
      } else setNotice("Enter an activity number shown in brackets, e.g. /inspect 5");
      return;
    }

    if (approval) {
      if (content === "/approve" || content === "/deny") {
        approvalResolve.current?.(content === "/approve");
        approvalResolve.current = null;
        setApproval(null);
        setStatus(content === "/approve" ? "Executing approved tool" : "Tool denied");
      } else if (content === "/stop") {
        stopTurn();
      } else {
        setNotice("A tool is waiting. Type /approve or /deny.");
      }
      return;
    }

    if (content === "/stop") { if (running.current) stopTurn(); else setNotice("Nothing is running."); return; }
    if (running.current) { setNotice("Bare is working. Press Esc or type /stop to cancel."); return; }

    if (content === "/clear") {
      setMessages([]);
      setExpanded(new Set());
      history.current = [SYSTEM_MESSAGE];
      setTokens({ input: 0, output: 0 });
      setScroll(0);
      setNotice("Conversation cleared");
      return;
    }
    if (content === "/help") {
      setNotice("/help  /clear  /demo  /inspect ID  /stop  /approve  /deny  ·  @src/file.ts");
      return;
    }
    if (content === "/demo") {
      setMessages(prev => [...prev,
        { id: ++nextId.current, role: "user", content: "Find and fix the bug in my C++ project." },
        { id: ++nextId.current, role: "assistant", kind: "thinking", toolStatus: "done",
          content: "Demo reasoning only: examine the function, identify the return-value error, and prepare a correction." },
        { id: ++nextId.current, role: "assistant", kind: "tool", toolId: -1,
          toolName: "write_file", content: "src/main.cpp", toolStatus: "done",
          detail: "src/main.cpp — proposed changes (DEMO)\n- return value - 1;\n+ return value + 1;\n\nResult:\nUpdated src/main.cpp (DEMO ONLY; no file changed)." },
        { id: ++nextId.current, role: "assistant", content: "**Demo only:** Here is a preview of an inspectable file change. No actual file was modified." },
      ]);
      setNotice("Click the Thinking / write_file rows, or type /inspect ID");
      return;
    }
    if (content.startsWith("/")) { setNotice("Unknown command. Type /help."); return; }
    void sendPrompt(content);
  }

  const cwd = process.cwd().replace(/^\/home\/[^/]+/, "~");
  return (
    <Box flexDirection="column" width={width} height={height}>
      {isWelcome ? (
        <Box flexDirection="column">
          <Box marginTop={1}><HoneyTitle /></Box>
          <Box marginTop={2} flexDirection="column">
            <Text color={theme.text}>Tips for getting started:</Text>
            <Text color={theme.muted}>1. Ask Bare a question or type /help for commands.</Text>
            <Text color={theme.muted}>2. Reference project files with @src/main.tsx.</Text>
            <Text color={theme.muted}>3. Approve file edits and commands before they run.</Text>
          </Box>
          <Box marginTop={3} justifyContent="space-between">
            <Text color={theme.dim}>Project tools available</Text>
            <Text color={theme.dim}>local session</Text>
          </Box>
        </Box>
      ) : (
<Box width={width} height={viewportHeight} flexDirection="row">
          <Box width={transcriptWidth} height={viewportHeight} flexDirection="column" justifyContent="flex-end">
            {visibleLines.map(row => (
              <TranscriptLine key={row.key} row={row} width={transcriptWidth} onToggle={toggleExpanded} />
            ))}
          </Box>
          <HoneyScrollbar
            height={viewportHeight}
            offset={offset}
            maxScroll={maxScroll}
            frame={honeyFrame}
            onSeek={setScroll}
          />
        </Box>
      )}

      {/* A Pi-style working indicator, visible while tokens are streaming. */}
      <Box height={1} marginTop={1}>
        {busy ? (
          <Text color={theme.honey}>{SPINNER[spinnerFrame]} {status || "Working"}…  <Text color={theme.dim}>{elapsedSeconds.toFixed(1)}s · Esc to stop</Text></Text>
        ) : notice ? (
          <Text color={theme.muted} wrap="truncate-end">{notice}</Text>
        ) : null}
      </Box>

      {approval && (
        <Box borderStyle="single" borderColor={theme.heading} paddingX={1} flexDirection="column">
          <Text color={theme.heading}>Approve {approval.tool}? {approval.summary}</Text>
          {approval.details.split("\n").slice(0, 3).map((line, i) => (
            <Text key={i} color={theme.muted} wrap="truncate-end">{line}</Text>
          ))}
          <Text color={theme.honey}>Type /approve or /deny and press Enter.</Text>
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor={theme.border} paddingX={1} width={width}>
        <Text color={theme.honey}>{"> "}</Text>
        <Box flexGrow={1}>
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit}
            placeholder={approval ? "/approve or /deny" : busy ? "/stop (or Esc)" : "Type your message or @path/to/file..."} />
        </Box>
      </Box>
      <Box marginTop={1} width={width} justifyContent="space-between">
        <Box flexShrink={1}>
          <Text color={theme.muted} wrap="truncate-end">{cwd}</Text>
        </Box>
        {width >= 72 && <Text color={theme.dim}>read · search · edit · shell</Text>}
        <Text color={theme.muted}> {BARE_MODEL} · {tokens.input + tokens.output} tok</Text>
      </Box>
    </Box>
  );
}
