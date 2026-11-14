import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'stats-package-'));
async function run(command: string[], cwd = temp) {
  const child = Bun.spawn(command, {
    cwd,
    env: { ...process.env, HUSKY: '0' },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (await child.exited) throw new Error(`Failed: ${command.join(' ')}`);
}
try {
  const tarball = join(temp, 'package.tgz');
  await run(['bun', 'pm', 'pack', '--filename', tarball], root);
  await cp(join(root, 'tests/package-consumer'), temp, { recursive: true });
  await writeFile(
    join(temp, 'package.json'),
    '{"private":true,"type":"module"}',
  );
  await run(['bun', 'add', '--ignore-scripts', '--omit=peer', tarball]);
  await run(['node', 'consumer.mjs']);
  // Resolve only Node types, never the checkout's framework peers or Bun globals.
  await writeFile(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        types: ['node'],
        typeRoots: [resolve(root, 'node_modules/@types')],
        noEmit: true,
      },
      files: ['consumer.ts'],
    }),
  );
  await run(['bun', 'check', '--no-script']);
} finally {
  await rm(temp, { recursive: true, force: true });
}
