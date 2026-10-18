import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Message } from "./types";

function Chat() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);

  function handleSubmit(value: string) {
    setInput("setMessages(previous => [
    ...previous,
    { role: "user", content: value }
]);");
  }
  return (
    <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
  );
}

export default Chat;
