// Deterministic check that each flagged clause's evidence_quote actually appears in the contract.
// The model is told to quote the contract; this verifies it did, without another model call.
import type { AnalysisResult, EvidenceCheck } from './types';

/** Share of the quote's words that must match, in order, for an "approximate" result. */
export const APPROXIMATE_THRESHOLD = 0.85;
/** Quotes shorter than this (in words) must match exactly; fuzzy matching on a few words is meaningless. */
export const MIN_FUZZY_WORDS = 5;

/**
 * Lowercased words and numbers, with typographic quotes, dashes, punctuation, line breaks and
 * spacing differences removed. PDF text extraction and the model both vary on those, so two
 * texts with the same words in the same order compare equal.
 */
export function words(text: string): string[] {
  return (text || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** The quote split at ellipses ("..." or "…"), since a model often elides the middle of a clause. */
export function quoteSegments(quote: string): string[][] {
  return (quote || '')
    .split(/\.{3,}|…|\[\.{3}\]/)
    .map(words)
    .filter((seg) => seg.length > 0);
}

/** Length of the longest common subsequence of two word lists. */
function lcs(a: string[], b: string[]): number {
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Best in-order match of one quote segment anywhere in the contract, from 0 to 1.
 * A sliding window finds the passage sharing the most words with the segment, then the
 * longest common subsequence over that passage (with some slack on each side) gives the share
 * of the segment's words found there in the same order.
 */
export function bestSegmentScore(segment: string[], contract: string[]): number {
  const n = segment.length;
  if (n === 0 || contract.length === 0) return 0;

  const need = new Map<string, number>();
  for (const w of segment) need.set(w, (need.get(w) ?? 0) + 1);

  const have = new Map<string, number>();
  let overlap = 0;
  let bestOverlap = -1;
  let bestStart = 0;
  const add = (w: string, delta: number) => {
    const req = need.get(w);
    if (req === undefined) return;
    const before = have.get(w) ?? 0;
    const after = before + delta;
    have.set(w, after);
    overlap += Math.min(after, req) - Math.min(before, req);
  };

  const width = Math.min(n, contract.length);
  for (let i = 0; i < contract.length; i++) {
    add(contract[i], 1);
    if (i >= width) add(contract[i - width], -1);
    const start = i - width + 1;
    if (start >= 0 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestStart = start;
    }
  }
  if (bestOverlap <= 0) return 0;

  const slack = Math.ceil(n / 4);
  const window = contract.slice(Math.max(0, bestStart - slack), bestStart + width + slack);
  return lcs(segment, window) / n;
}

/** Whether `needle` occurs in `haystack` as a contiguous word sequence at or after `from`. */
function indexOfWords(haystack: string, needle: string[], from: number): number {
  return haystack.indexOf(` ${needle.join(' ')} `, from);
}

/**
 * verified    every segment of the quote appears word for word, in order, in the contract
 * approximate the quote is long enough to compare and at least 85% of its words match in order
 *             (typically a paraphrased word or an OCR slip); shown with a warning
 * not_found   the quote cannot be located in the contract; the finding should not be relied on
 */
export function verifyQuote(quote: string, contractText: string): EvidenceCheck {
  const segments = quoteSegments(quote);
  const contract = words(contractText);
  if (segments.length === 0 || contract.length === 0) return { status: 'not_found', score: 0 };

  const haystack = ` ${contract.join(' ')} `;
  let from = 0;
  let exact = true;
  for (const seg of segments) {
    const at = indexOfWords(haystack, seg, from);
    if (at < 0) {
      exact = false;
      break;
    }
    from = at + seg.join(' ').length + 1;
  }
  if (exact) return { status: 'verified', score: 1 };

  const total = segments.reduce((sum, seg) => sum + seg.length, 0);
  const matched = segments.reduce((sum, seg) => sum + bestSegmentScore(seg, contract) * seg.length, 0);
  const score = Math.round((matched / total) * 100) / 100;
  if (total >= MIN_FUZZY_WORDS && score >= APPROXIMATE_THRESHOLD) return { status: 'approximate', score };
  return { status: 'not_found', score };
}

/** Returns a copy of the analysis with an evidence_check on every flagged clause. */
export function attachEvidenceChecks(result: AnalysisResult, contractText: string): AnalysisResult {
  const clauses = Array.isArray(result?.flagged_clauses) ? result.flagged_clauses : [];
  return {
    ...result,
    flagged_clauses: clauses.map((clause) => ({
      ...clause,
      evidence_check: verifyQuote(clause?.evidence_quote ?? '', contractText),
    })),
  };
}

/** Counts by status, for the summary line above the flagged clauses. */
export function evidenceSummary(result: AnalysisResult): Record<EvidenceCheck['status'], number> {
  const counts = { verified: 0, approximate: 0, not_found: 0 };
  for (const clause of result?.flagged_clauses ?? []) {
    if (clause.evidence_check) counts[clause.evidence_check.status]++;
  }
  return counts;
}
