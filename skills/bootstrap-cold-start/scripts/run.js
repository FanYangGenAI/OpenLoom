#!/usr/bin/env node

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

const openloomDir = getArg('--openloom') || '.openloom';
const root = getArg('--root') || null;
const nonInteractive = args.includes('--non-interactive');

process.stdout.write(
  `${JSON.stringify(
    {
      status: 'planned',
      openloom_dir: openloomDir,
      default_root: root,
      non_interactive: nonInteractive,
      checks: {
        deepseek_api_key: Boolean(process.env.DEEPSEEK_API_KEY),
        ollama_env: Boolean(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL),
      },
    },
    null,
    2,
  )}\n`,
);
