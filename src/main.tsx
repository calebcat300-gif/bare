import React from 'react';
import { render, Box, useStdout } from 'ink';
import Bear from './Bear';
import HoneyTitle from './HoneyTitle';

function App() {
	const { stdout } = useStdout();

	return (
		<Box
			width={stdout.columns}
			height={stdout.rows - 1}
			justifyContent="center"
			alignItems="center"
		>
			<Box flexDirection="row" alignItems="center">
				<HoneyTitle />
				<Bear />
			</Box>
		</Box>
	);
}

render(<App />);