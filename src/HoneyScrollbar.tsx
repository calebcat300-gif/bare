import React from "react";
import { Box, Text } from "ink";
import { Clickable } from "ink-use-mouse";

// Match the palette and moving two-wave texture in HoneyTitle.tsx.
const HONEY = [
  "#A9570F", "#C87514", "#E99C1B", "#FFC12E",
  "#FFDC57", "#FFE889", "#FFF5B5",
];
const EMPTY_TRACK = "#594531";

type Props = {
  height: number;
  offset: number;    // 0 = newest messages, maxScroll = oldest messages
  maxScroll: number;
  frame: number;
  onSeek: (offset: number) => void;
};

function honeyColor(x: number, y: number, frame: number): string {
  const wave1 = Math.sin(x * 0.38 - frame * 0.38 + y * 0.7);
  const wave2 = Math.sin(x * 0.17 + frame * 0.24 - y * 0.9);
  const normalized = (wave1 * 0.7 + wave2 * 0.3 + 1) / 2;
  const index = Math.max(0, Math.min(HONEY.length - 1, Math.floor(normalized * HONEY.length)));
  return HONEY[index];
}

export default function HoneyScrollbar({
  height, offset, maxScroll, frame, onSeek,
}: Props) {
  const h = Math.max(1, height);

  // No scrollbar on the splash screen or short conversations.
  // Keep its two reserved columns so messages never jump horizontally.
  if (maxScroll <= 0) return <Box width={2} height={h} />;

  // At the newest messages, only the bottom cell is honey.
  // As the reader scrolls up, the honey level rises.
  const fraction = Math.min(1, Math.max(0, offset / maxScroll));
  const filled = 1 + Math.round(fraction * (h - 1));
  const surface = h - filled;

  return (
    <Box width={2} height={h} flexDirection="column">
      {Array.from({ length: h }, (_, y) => {
        const wet = y >= surface;
        const jumpTo = h === 1
          ? 0
          : Math.round(((h - 1 - y) / (h - 1)) * maxScroll);

        return (
          <Clickable key={y} onClick={() => onSeek(jumpTo)}>
            <Box width={2} height={1} flexDirection="row">
              <Text>{" "}</Text>
              <Text color={wet ? honeyColor(0, y, frame) : EMPTY_TRACK}>
                {wet ? (y === surface ? "▄" : "█") : "│"}
              </Text>
            </Box>
          </Clickable>
        );
      })}
    </Box>
  );
}
