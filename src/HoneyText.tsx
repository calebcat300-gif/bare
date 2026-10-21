import React, { useState, useEffect } from "react";
import { Text } from "ink";
import { honeyColor } from "./HoneyTitle";

type HoneyTextProps = {
  text: string;
};

function HoneyText({ text }: HoneyTextProps) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTime((previous) => previous + 1);
    }, 110);

    return () => clearInterval(timer);
  }, []);
  return (
    <Text>
      {text.split("").map((char, x) => (
        <Text key={x} color={honeyColor(x, 0, time)}>
          {char}
        </Text>
      ))}
    </Text>
  );
}

export default HoneyText;
