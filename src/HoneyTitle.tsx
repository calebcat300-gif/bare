import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

// Each letter is drawn using seven rows.
const LETTERS = [
  // B
  ["██████ ", "██   ██", "██   ██", "██████ ", "██   ██", "██   ██", "██████ "],
  // A
  [" █████ ", "██   ██", "██   ██", "███████", "██   ██", "██   ██", "██   ██"],
  // R
  ["██████ ", "██   ██", "██   ██", "██████ ", "██  ██ ", "██   ██", "██   ██"],
  // E
  ["███████", "██     ", "██     ", "██████ ", "██     ", "██     ", "███████"],
];

const LOGO = Array.from({ length: 7 }, (_, row) =>
  LETTERS.map((letter) => letter[row]).join("  "),
);

// Honey colors: dark amber through bright gold.
const HONEY_COLORS = [
  "#A9570F",
  "#C87514",
  "#E99C1B",
  "#FFC12E",
  "#FFDC57",
  "#FFE889",
  "#FFF5B5",
];

function honeyColor(x: number, y: number, time: number) {
  // Two moving waves create a liquid-like pattern.
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

function HoneyTitle() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((previous) => previous + 1);
    }, 110);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" marginRight={4}>
      {LOGO.map((line, y) => (
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
