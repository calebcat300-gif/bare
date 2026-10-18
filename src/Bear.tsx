
import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { renderFrame } from './sprite';

function Bear() {
    const [art, setArt] = useState('');

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | undefined;

        // Load all 12 bear frames
        Promise.all(
            Array.from({ length: 12 }, (_, i) => renderFrame(i))
        ).then(frames => {
            if (cancelled) return;

            let frame = 0;
            setArt(frames[frame]);

            // Display the next frame every 120ms
            timer = setInterval(() => {
                frame++;
                setArt(frames[frame]);

                // Stop after the final frame
                if (frame === frames.length - 1) {
                    clearInterval(timer);
                }
            }, 120);
        });

        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
        };
    }, []);

    return <Text>{art}</Text>;
}

export default Bear;
