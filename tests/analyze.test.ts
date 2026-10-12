import { describe, expect, it, vi } from 'vitest';

// Replace only the Gemini client; routing and validation stay real. No network call is made.
const modelOutput = vi.hoisted(() => ({ text: '' }));
vi.mock('../server/gemini', async (importOriginal) => {
  const real = await importOriginal<typeof import('../server/gemini')>();
  return {
    ...real,
    gemini: () => ({ models: { generateContent: async () => ({ text: modelOutput.text }) } }),
  };
});

import handler from '../api/analyze';

function call(body: unknown) {
  return new Promise<{ status: number; data: any }>((resolve) => {
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      json(data: unknown) {
        resolve({ status, data });
      },
    };
    handler({ method: 'POST', body: JSON.stringify(body) }, res);
  });
}

const contractText = 'Client may terminate this Agreement at any time upon five (5) days written notice.';

describe('/api/analyze', () => {
  it('attaches an evidence check to every flagged clause', async () => {
    modelOutput.text = JSON.stringify({
      flagged_clauses: [
        { clause_name: 'Termination', evidence_quote: 'Client may terminate this Agreement at any time' },
        { clause_name: 'Indemnity', evidence_quote: 'Provider shall indemnify Client against all claims.' },
      ],
    });
    const { status, data } = await call({ contractText, contractType: 'Service Agreement' });
    expect(status).toBe(200);
    const result = JSON.parse(data.text);
    expect(result.flagged_clauses.map((c: any) => c.evidence_check.status)).toEqual(['verified', 'not_found']);
  });

  it('passes through a response that is not JSON, as before', async () => {
    modelOutput.text = 'not json';
    const { status, data } = await call({ contractText });
    expect(status).toBe(200);
    expect(data.text).toBe('not json');
  });
});
