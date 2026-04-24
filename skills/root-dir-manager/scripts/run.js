#!/usr/bin/env node

const args = process.argv.slice(2);
const action = args[0] || 'show';

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

const openloomDir = getArg('--openloom') || '.openloom';
const rootPath = action === 'set' ? args[1] : null;

process.stdout.write(
  `${JSON.stringify(
    {
      status: 'planned',
      action,
      openloom_dir: openloomDir,
      default_root: rootPath,
    },
    null,
    2,
  )}\n`,
);
