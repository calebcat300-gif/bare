import React, { useMemo } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

// Exactly the palette and two-wave formula used by HoneyTitle / honey spill.
// Deliberately self-contained: changing this won't break the intro.
const HONEY = [
  "#A9570F", "#C87514", "#E99C1B", "#FFC12E",
  "#FFDC57", "#FFE889", "#FFF5B5",
];
const IDLE = "#75542D";
const PROMPT = "#FFC12E";

type Props = {
  width: number;
  active: boolean;
  frame: number;
  input: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

function honeyColor(x: number, y: number, time: number): string {
  const wave1 = Math.sin(x * 0.38 - time * 0.38 + y * 0.7);
  const wave2 = Math.sin(x * 0.17 + time * 0.24 - y * 0.9);
  const mixture = wave1 * 0.7 + wave2 * 0.3;
  const normalized = (mixture + 1) / 2;
  const index = Math.min(HONEY.length - 1, Math.max(0, Math.floor(normalized * HONEY.length)));
  return HONEY[index];
}

// Ink-friendly colored text: merge adjacent characters with the same color.
// Only 1-cell-wide Unicode characters are used, so each row stays exactly 'width' cells.
function ColorLine({ chars, y, active, frame }: {
  chars: string;
  y: number;
  active: boolean;
  frame: number;
}) {
  const runs = useMemo(() => {
    if (!active) return [{ text: chars, color: IDLE }];
    const result: { text: string; color: string }[] = [];
    for (let x = 0; x < chars.length; x++) {
      const color = honeyColor(x, y, frame);
      const last = result[result.length - 1];
      if (last?.color === color) last.text += chars[x];
      else result.push({ color, text: chars[x] });
    }
    return result;
  }, [chars, y, active, frame]);

  return (
    <Text wrap="truncate">
      {runs.map((run, i) => (
        <Text key={i} color={run.color}>{run.text}</Text>
      ))}
    </Text>
  );
}

// Drips are part of the SAME composer, rather than an extra component
// modifying the position of the footer and transcript.
function makeBottom(width: number, _active: boolean, _frame: number) {
  // No dripping shapes. Keep a constant-height composer to prevent UI jumps.
  const border = `└${"─".repeat(Math.max(0, width - 2))}┘`;
  const drip = " ".repeat(width);
  return { border, drip };
}

export default function HoneyComposer({
  width, active, frame, input, placeholder, onChange, onSubmit,
}: Props) {
  const w = Math.max(12, width);
  const { border, drip } = useMemo(
    () => makeBottom(w, active, frame),
    [w, active, frame],
  );

  return (
    <Box width={w} height={4} marginTop={1} flexDirection="column">
      <ColorLine chars={`┌${"─".repeat(w - 2)}┐`} y={0} active={active} frame={frame} />

      {/* EXACTLY one input row, bounded on both sides by the honey border. */}
      <Box width={w} height={1} flexDirection="row">
        <Text color={active ? honeyColor(0, 1, frame) : IDLE}>│</Text>
        <Text color={PROMPT}>{" > "}</Text>
        <Box width={w - 5} height={1} flexShrink={1}>
          <TextInput
            value={input}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder}
          />
        </Box>
        <Text color={active ? honeyColor(w - 1, 1, frame) : IDLE}>│</Text>
      </Box>

      <ColorLine chars={border} y={2} active={active} frame={frame} />
      <ColorLine chars={drip} y={3} active={active} frame={frame} />
    </Box>
  );
}
