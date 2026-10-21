import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const LETTERS = [
  ["██████ ", "██   ██", "██   ██", "██████ ", "██   ██", "██   ██", "██████ "],
  [" █████ ", "██   ██", "██   ██", "███████", "██   ██", "██   ██", "██   ██"],
  ["██████ ", "██   ██", "██   ██", "██████ ", "██  ██ ", "██   ██", "██   ██"],
  ["███████", "██     ", "██     ", "██████ ", "██     ", "██     ", "███████"],
];

const LOGO = Array.from({ length: 7 }, (_, row) =>
  LETTERS.map((letter) => letter[row]).join("  "),
);

export const HONEY_COLORS = [
  "#A9570F",
  "#C87514",
  "#E99C1B",
  "#FFC12E",
  "#FFDC57",
  "#FFE889",
  "#FFF5B5",
];

export function honeyColor(x: number, y: number, time: number) {
  const wave1 = Math.sin(x * 0.38 - time * 0.38 + y * 0.7);
  const wave2 = Math.sin(x * 0.17 + time * 0.24 - y * 0.9);

  const mixture = wave1 * 0.7 + wave2 * 0.3;
  const normalized = (mixture + 1) / 2;

  const index = Math.min(
    HONEY_COLORS.length - 1,
    Math.max(0, Math.floor(normalized * HONEY_COLORS.length)),
  );

  return HONEY_COLORS[index];
}

type HoneyTitleProps = {
  scale?: 1 | 2;
  marginRight?: number;
};

function HoneyTitle({ scale = 1, marginRight = 4 }: HoneyTitleProps) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((previous) => previous + 1);
    }, 110);

    return () => clearInterval(timer);
  }, []);

  const rows = LOGO.flatMap((line, y) =>
    Array.from({ length: scale }, (_, repeat) => ({
      y: y * scale + repeat,
      line: Array.from(line)
        .map((char) => char.repeat(scale))
        .join(""),
    })),
  );

  return (
    <Box flexDirection="column" marginRight={marginRight}>
      {rows.map(({ line, y }) => (
        <Text key={y} wrap="truncate">
          {Array.from(line).map((char, x) =>
            char === " " ? (
              " "
            ) : (
              <Text key={x} color={honeyColor(x, y, time)}>
                {char}
              </Text>
            ),
          )}
        </Text>
      ))}
    </Box>
  );
}

export default HoneyTitle;
