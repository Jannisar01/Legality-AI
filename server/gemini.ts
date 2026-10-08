// Shared helpers for the /api functions (Vercel Node runtime; the Vite dev plugin runs them locally).
import { GoogleGenAI } from '@google/genai';

// a long contract is ~100k characters; anything far beyond that is not a contract
export const MAX_CHARS = 150_000;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'GEMINI_API_KEY is not set on the server.');
  return new GoogleGenAI({ apiKey });
}

export function text(body: any, field: string, required = true): string {
  const value = body?.[field];
  if (value == null || value === '') {
    if (required) throw new HttpError(400, `Missing "${field}".`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `"${field}" must be text.`);
  if (value.length > MAX_CHARS) throw new HttpError(413, `"${field}" is too long.`);
  return value;
}

type Handler = (body: any) => Promise<{ text?: string }>;

// Wraps a handler: POST only, JSON in and out, errors as { error }.
export function route(handler: Handler) {
  return async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
      res.status(200).json(await handler(body));
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : 502;
      console.error(err);
      res.status(status).json({ error: status === 502 ? 'The AI model call failed. Please try again.' : err.message });
    }
  };
}
