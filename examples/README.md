# Examples

Build the root package first with `bun install --frozen-lockfile && bun run build`.
In an example directory run `bun install`, then `bun start` (Elysia) or
`npm start` (all Node examples). Each listens on port 8080 and exposes an explicitly
registered `/stats` route. These routes are public for demonstration only.

- `elysia-example`: Bun and Elysia.
- `express-example`: Express 5.
- `node-example`: plain Node HTTP.
- `fastify-example`: native Fastify onRequest hook.
- `hono-example`: Hono with the Node server bridge.
- `nestjs-example`: bootstrapped Nest Express; use `npm run start:fastify` for
  Nest Fastify. Programmatic decorators work with plain Node ESM, no transpiler.

Node examples require Node 22+. Run one example at a time (shared port 8080).
