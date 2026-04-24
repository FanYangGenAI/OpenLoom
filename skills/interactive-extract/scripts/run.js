#!/usr/bin/env node

const args = process.argv.slice(2);
const asJson = args.includes('--json');

const payload = {
  ocrProvider: 'online',
  skipFaceDetection: false,
  textConcurrency: 5,
  imageConcurrency: 3,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write('Use --json to output resolved interactive extract options.\n');
}
