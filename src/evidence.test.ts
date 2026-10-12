import { describe, expect, it } from 'vitest';
import { attachEvidenceChecks, evidenceSummary, verifyQuote, words } from './evidence';
import { mockAnalysisResult } from './mockData';
import type { AnalysisResult } from './types';

const CONTRACT = `SERVICES AGREEMENT

1. Term. This Agreement begins on the Effective Date and renews automatically for successive
one (1) year terms unless either party gives notice of non-renewal at least ninety (90) days
before the end of the then-current term.

7. Liability. Provider shall be liable for any and all indirect, incidental, special, or
consequential damages arising out of or relating to this Agreement.

9. Intellectual Property. All intellectual property rights in any materials created, developed,
or provided by the Provider under this Agreement shall immediately vest in and become the
exclusive property of the Client.

12. Termination. Client may terminate this Agreement at any time for convenience upon five (5)
days written notice. Provider may terminate only for Client's material breach that remains
uncured for sixty (60) days after written notice.`;

describe('words', () => {
  it('ignores case, punctuation, typographic quotes and line breaks', () => {
    expect(words('“Client’s”  —\nNOTICE (5) days.')).toEqual(['client', 's', 'notice', '5', 'days']);
  });
});

describe('verifyQuote', () => {
  it('verifies a verbatim quote', () => {
    const q = 'Client may terminate this Agreement at any time for convenience upon five (5) days written notice.';
    expect(verifyQuote(q, CONTRACT)).toEqual({ status: 'verified', score: 1 });
  });

  it('verifies across line breaks, curly quotes, dashes and case differences', () => {
    const q = '“PROVIDER shall be liable for any and all indirect, incidental, special, or consequential damages”';
    expect(verifyQuote(q, CONTRACT).status).toBe('verified');
  });

  it('verifies a quote with an ellipsis when both parts appear in order', () => {
    const q = 'All intellectual property rights ... shall immediately vest in and become the exclusive property of the Client';
    expect(verifyQuote(q, CONTRACT).status).toBe('verified');
  });

  it('does not verify ellipsis parts that appear in the wrong order', () => {
    const q = 'exclusive property of the Client … All intellectual property rights in any materials';
    expect(verifyQuote(q, CONTRACT).status).not.toBe('verified');
  });

  it('marks a quote with one changed word as approximate, not verified', () => {
    const q = 'Client may terminate this Agreement at any time for convenience upon ten (5) days written notice';
    const check = verifyQuote(q, CONTRACT);
    expect(check.status).toBe('approximate');
    expect(check.score).toBeGreaterThanOrEqual(0.85);
    expect(check.score).toBeLessThan(1);
  });

  it('rejects a fabricated quote', () => {
    const q = 'Provider shall indemnify Client against all third-party claims without limitation or cap.';
    const check = verifyQuote(q, CONTRACT);
    expect(check.status).toBe('not_found');
    expect(check.score).toBeLessThan(0.85);
  });

  it('rejects a plausible paraphrase that rewrites the clause', () => {
    const q = 'Either party may end the agreement on five days notice for any reason.';
    expect(verifyQuote(q, CONTRACT).status).toBe('not_found');
  });

  it('does not fuzzy-match short quotes', () => {
    expect(verifyQuote('ninety (91) days', CONTRACT).status).toBe('not_found');
    expect(verifyQuote('ninety (90) days', CONTRACT).status).toBe('verified');
  });

  it('treats empty quotes and empty contracts as not found', () => {
    expect(verifyQuote('', CONTRACT).status).toBe('not_found');
    expect(verifyQuote('   ...  ', CONTRACT).status).toBe('not_found');
    expect(verifyQuote('Client may terminate', '').status).toBe('not_found');
  });

  it('handles a long contract quickly', () => {
    const long = (CONTRACT + '\n').repeat(400); // ~200k characters
    const start = Date.now();
    expect(verifyQuote('Provider shall indemnify Client against all third-party claims', long).status).toBe('not_found');
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('attachEvidenceChecks', () => {
  it('adds a check to every flagged clause without changing the rest', () => {
    const fabricated = {
      ...mockAnalysisResult.flagged_clauses[0],
      clause_name: 'Indemnity',
      evidence_quote: 'Provider shall indemnify Client against all claims without limit.',
    };
    const input: AnalysisResult = {
      ...mockAnalysisResult,
      flagged_clauses: [...mockAnalysisResult.flagged_clauses, fabricated],
    };
    const out = attachEvidenceChecks(input, CONTRACT);

    expect(out.flagged_clauses.map((c) => c.evidence_check?.status)).toEqual([
      'verified',
      'verified',
      'verified',
      'not_found',
    ]);
    expect(out.executive_summary).toBe(input.executive_summary);
    expect(input.flagged_clauses[0].evidence_check).toBeUndefined(); // input not mutated
    expect(evidenceSummary(out)).toEqual({ verified: 3, approximate: 0, not_found: 1 });
  });

  it('tolerates a model response without flagged_clauses', () => {
    const out = attachEvidenceChecks({ ...mockAnalysisResult, flagged_clauses: undefined as any }, CONTRACT);
    expect(out.flagged_clauses).toEqual([]);
  });
});
