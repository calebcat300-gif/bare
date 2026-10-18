import React from "react";
import { render, Box, useStdout } from "ink";
import Bear from "./Bear";
import HoneyTitle from "./HoneyTitle";
import Chat from "./Chat";
function App() {
  const { stdout } = useStdout();

  return (
    <Box
      flexDirection="column"
      width={stdout.columns}
      height={stdout.rows - 1}
      justifyContent="center"
      alignItems="center"
    >
      <Box flexDirection="row" alignItems="center">
        <HoneyTitle />
        <Bear />
      </Box>

      <Chat />
    </Box>
  );
}

render(<App />);
