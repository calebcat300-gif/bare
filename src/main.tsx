import React, { useEffect, useState } from "react";
import { render, Box, useStdout } from "ink";
import Manager from "./Manager";
import Bear from "./Bear";
import HoneyTitle from "./HoneyTitle";
import HoneyTransition from "./HoneyTransition";
import Chat from "./Chat";

type Screen = "intro" | "honey" | "chat";

function App() {
  const { stdout } = useStdout();

  const [screen, setScreen] = useState<Screen>("intro");

  useEffect(() => {
    const timer = setTimeout(() => {
      setScreen("honey");
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      width={stdout.columns}
      height={stdout.rows - 1}
      flexDirection="column"
      justifyContent={screen === "chat" ? "flex-start" : "center"}
      alignItems="center"
    >
      {screen === "intro" && (
        <Box flexDirection="row" alignItems="center">
          <HoneyTitle />
          <Bear />
        </Box>
      )}

      {screen === "honey" && (
        <HoneyTransition onComplete={() => setScreen("chat")} />
      )}

      {screen === "chat" && <Chat />}
    </Box>
  );
}
render(process.argv.includes("--manager") ? <Manager /> : <App />, {
  alternateScreen: true,
});
