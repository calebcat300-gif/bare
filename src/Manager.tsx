import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import HoneyText from "./HoneyText";
import HoneyTitle from "./HoneyTitle";

const MENU_ITEMS = [
  {
    label: "Provider & Model",
    description:
      "Connect local or remote models and configure your inference provider.",
  },
  {
    label: "Appearance",
    description: "Customize Bare's colors, themes, and terminal appearance.",
  },
  {
    label: "Settings",
    description:
      "Manage preferences, tool permissions, and application configuration.",
  },
];

function Manager() {
  const [selected, setSelected] = useState(0);
  const { stdout } = useStdout();

  const logoScale = stdout.columns >= 76 && stdout.rows >= 36 ? 2 : 1;

  const logoWidth = 34 * logoScale;
  const contentWidth = Math.min(stdout.columns - 4, Math.max(logoWidth, 66));

  const isWide = stdout.columns >= 66;
  const current = MENU_ITEMS[selected];

  useInput((input, key) => {
    if (key.downArrow) {
      setSelected((prev) => (prev + 1) % MENU_ITEMS.length);
    }

    if (key.upArrow) {
      setSelected((prev) => (prev + MENU_ITEMS.length - 1) % MENU_ITEMS.length);
    }
  });

  return (
    <Box
      width={stdout.columns}
      height={stdout.rows - 1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Box flexDirection="column" alignItems="center">
        <Box width={logoWidth} flexDirection="column" alignItems="flex-start">
          <HoneyTitle scale={logoScale} marginRight={0} />
          <Text bold color="#FFC12E">
            manager
          </Text>
        </Box>

        <Box width={contentWidth} justifyContent="center" marginTop={1}>
          <Text color="#CBA77E">Export. Import. All in your hands.</Text>
        </Box>

        <Box marginTop={2}>
          <Text color="#493727">{"─".repeat(contentWidth)}</Text>
        </Box>

        <Box
          width={contentWidth}
          flexDirection={isWide ? "row" : "column"}
          marginTop={2}
        >
          <Box
            flexDirection="column"
            width={isWide ? 26 : contentWidth}
            alignItems={isWide ? "flex-start" : "center"}
            justifyContent="center"
            gap={1}
          >
            {MENU_ITEMS.map((item, index) => (
              <Box key={item.label}>
                {selected === index ? (
                  <HoneyText text={`❯ ${item.label}`} />
                ) : (
                  <Text>{`  ${item.label}`}</Text>
                )}
              </Box>
            ))}
          </Box>

          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle="single"
            borderColor="#493727"
            borderTop={false}
            borderBottom={false}
            borderLeft={isWide}
            borderRight={false}
            paddingLeft={isWide ? 2 : 0}
            marginTop={isWide ? 0 : 2}
            alignItems={isWide ? "flex-start" : "center"}
            justifyContent="center"
            gap={1}
          >
            <Text bold color="#D9B989">
              {current.label}
            </Text>

            <Text color="#A99B8B" wrap="wrap">
              {current.description}
            </Text>

            <Box marginTop={1}>
              <Text color="#927D65">Enter to configure →</Text>
            </Box>
          </Box>
        </Box>

        <Box marginTop={2}>
          <Text color="#493727">{"─".repeat(contentWidth)}</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="#807263">↑↓ navigate · enter select · esc back</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default Manager;
