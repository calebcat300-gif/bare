import type { Message } from './types';

const messages: Message[] = [
    {
        role: "user",
        content: "Hello Bare!"
    },
    {
        role: "assistant",
        content: "Hey! What are we building today?"
    }
];

console.log(messages);