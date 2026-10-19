import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useStdout } from "ink";
import { HONEY_COLORS, honeyColor } from "./HoneyTitle";

type Props = {
  onComplete: () => void;
};

const DURATION = 1900;
const FRAME_INTERVAL = 65;

// Matches Bare's dark background.
const BACKGROUND = [16, 17, 19];

// Convert the logo's color to a terminal color,
// fading it toward the background when needed.
function terminalColor(hex: string, fade: number) {
  const value = parseInt(hex.slice(1), 16);

  const rgb = [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ];

  const faded = rgb.map((channel, i) =>
    Math.round(
      channel * (1 - fade) + BACKGROUND[i] * fade
    )
  );

  return `\x1b[38;2;${faded.join(";")}m`;
}

export default function HoneyTransition({ onComplete }: Props) {
  const { stdout } = useStdout();

  const width = Math.max(1, stdout.columns - 1);
  const height = Math.max(1, stdout.rows - 1);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();

    const timer = setInterval(() => {
      const time = Math.min(Date.now() - start, DURATION);

      setElapsed(time);

      if (time >= DURATION) {
        clearInterval(timer);
        onComplete();
      }
    }, FRAME_INTERVAL);

    return () => clearInterval(timer);
  }, [onComplete]);

  const lines = useMemo(() => {
    const progress = elapsed / DURATION;

    // Honey pours downward during the first 70%.
    const spill = Math.min(1, progress / 0.7);

    // After filling the screen, smoothly fade to dark.
    const fade = Math.max(
      0,
      Math.min(1, (progress - 0.72) / 0.28)
    );

    // Reuse the EXACT palette from HoneyTitle.
    const palette = new Map(
      HONEY_COLORS.map(color => [
        color,
        terminalColor(color, fade),
      ])
    );

    const frame: string[] = [];

    // Move the honey pattern at the same rate as the logo.
    const time = Math.floor(elapsed / 110);

    for (let y = 0; y < height; y++) {
      let line = "";
      let lastColor = "";

      for (let x = 0; x < width; x++) {
        // Main downward-moving honey surface.
        const surface = spill * (height + 12) - 3;

        // Moving waves give the surface an uneven edge.
        const wave =
          Math.sin(x * 0.18 + elapsed * 0.004) * 2 +
          Math.sin(x * 0.055) * 3;

        // Long, rounded drips hanging below the surface.
        const dripWave =
          (Math.sin(x * 0.35 + 0.7) + 1) / 2;

        const drip = Math.pow(dripWave, 8) * 8;

        const honeyEdge = surface + wave + drip - 4;

        if (y > honeyEdge) {
          line += " ";
          lastColor = "";
          continue;
        }

        // Same function, same waves, same colors as BARE.
        const color = honeyColor(x, y, time);

        if (color !== lastColor) {
          line += palette.get(color);
          lastColor = color;
        }

        // Same solid block character as the logo.
        line += "█";
      }

      frame.push(line + "\x1b[39m");
    }

    return frame;
  }, [elapsed, width, height]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {lines.map((line, index) => (
        <Text key={index} wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  );
}
