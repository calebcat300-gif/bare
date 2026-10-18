import type { Message } from './types';

const messages: Message[] = [
    {
        role: "user",
        content: "Hello Bare!"
    },
    {
        role: "assistant",
        content: "Hello! How can I help?"
    }
];

console.log(messages);