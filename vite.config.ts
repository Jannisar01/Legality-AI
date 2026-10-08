import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/** Serves /api/* in `npm run dev` with the same handlers Vercel runs in production. */
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.match(/^\/api\/(analyze|chat|revise)(\?.*)?$/)?.[1];
        if (!name) return next();
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const handler = (await server.ssrLoadModule(`/api/${name}.ts`)).default;
        const out = {
          status(code: number) { res.statusCode = code; return out; },
          json(data: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); },
        };
        await handler({ method: req.method, body: raw }, out);
      });
    },
  };
}

export default defineConfig(({mode}) => {
  // the /api handlers read the key from process.env, also when it comes from a local .env file
  const env = loadEnv(mode, '.', '');
  process.env.GEMINI_API_KEY ??= env.GEMINI_API_KEY;
  return {
    plugins: [react(), tailwindcss(), apiDev()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
