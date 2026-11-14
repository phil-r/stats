import { rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [
    'src/index.ts',
    'src/elysia.ts',
    'src/express.ts',
    'src/fastify.ts',
    'src/hono.ts',
  ],
  outdir: 'dist',
  target: 'node',
  format: 'esm',
  splitting: true,
  packages: 'external',
});
if (!result.success) throw new AggregateError(result.logs, 'Build failed');
// The Bun version pinned in .bun-version does not emit declarations. TypeScript is used ONLY for emission;
// bun check is the project's typechecking command.
const declarations = Bun.spawn(
  ['bun', 'x', '--no-install', 'tsc', '-p', 'tsconfig.build.json'],
  {
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
if (await declarations.exited) process.exit(1);
