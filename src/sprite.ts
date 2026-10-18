import sharp from 'sharp';

const SHEET_PATH = 'assets/bear/Bear/Bear_Idle.png';
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 33;

export async function renderFrame(frameIndex: number): Promise<string> {
	const image = sharp(SHEET_PATH);

	const frame = image.extract({
		left: frameIndex * FRAME_WIDTH,
		top: 0,
		width: FRAME_WIDTH,
		height: FRAME_HEIGHT
	});

	const { data, info } = await frame
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	let output = '';

	for (let y = 0; y < info.height; y += 2) {
		let line = '';

		for (let x = 0; x < info.width; x++) {
			const top = (y * info.width + x) * 4;

			const bottom =
				y + 1 < info.height
					? ((y + 1) * info.width + x) * 4
					: -1;

			const topVisible = data[top + 3] > 0;
			const bottomVisible =
				bottom !== -1 && data[bottom + 3] > 0;

			if (topVisible && bottomVisible) {
				const fg = `\x1b[38;2;${data[top]};${data[top + 1]};${data[top + 2]}m`;
				const bg = `\x1b[48;2;${data[bottom]};${data[bottom + 1]};${data[bottom + 2]}m`;
				line += `${fg}${bg}▀\x1b[0m`;
			} else if (topVisible) {
				const fg = `\x1b[38;2;${data[top]};${data[top + 1]};${data[top + 2]}m`;
				line += `${fg}▀\x1b[0m`;
			} else if (bottomVisible) {
				const fg = `\x1b[38;2;${data[bottom]};${data[bottom + 1]};${data[bottom + 2]}m`;
				line += `${fg}▄\x1b[0m`;
			} else {
				line += ' ';
			}
		}

		output += line + '\n';
	}

	return output;
}
