
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

const bear = [
  '     ( )   ( )    ',
  '    /  o   o  \\   ',
  '   (     ᴥ     )  ',
  '    \\_       _/   ',
  '      |     |     ',
];

const blink = '    /  -   -  \\   ';

const frames = [
  { rows: 0, ms: 100 },
  { rows: 1, ms: 110 },
  { rows: 2, ms: 110 },
  { rows: 3, ms: 110 },
  { rows: 4, ms: 110 },
  { rows: 5, ms: 550 },
  { rows: 5, ms: 160, blink: true },
  { rows: 5, ms: 500 },
  { rows: 4, ms: 110 },
  { rows: 3, ms: 110 },
  { rows: 2, ms: 110 },
  { rows: 1, ms: 110 },
  { rows: 0, ms: 0 },
];

type Props = {
  active: boolean;
  width: number;
};

export default function PeekBear({ active, width }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) {
      setFrame(0);
      return;
    }

    if (frame >= frames.length - 1) return;

    const timer = setTimeout(() => {
      setFrame(current => current + 1);
    }, frames[frame].ms);

    return () => clearTimeout(timer);
  }, [active, frame]);

  const current = frames[frame];
  const offset = Math.max(0, width - 26);

  const lines = [
    ...Array(bear.length - current.rows).fill(''),
    ...bear.slice(0, current.rows),
  ];

  if (current.blink && current.rows >= 2) {
    lines[bear.length - current.rows + 1] = blink;
  }

  const border = Array(width).fill('─');
  border[0] = '╭';
  border[width - 1] = '╮';

  if (current.rows === 5) {
    border[offset + 6] = 'o';
    border[offset + 12] = 'o';
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={index}>
          {' '.repeat(offset)}{line || ' '}
        </Text>
      ))}

      <Text>{border.join('')}</Text>
    </Box>
  );
}
