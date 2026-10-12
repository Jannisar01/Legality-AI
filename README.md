<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4413e487-409d-4331-9278-9137d2ac9ca3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

The Gemini calls run on the server (`api/analyze.ts`, `api/chat.ts`, `api/revise.ts`), so the API
key never reaches the browser. In development, Vite serves those same handlers at `/api/*`.

## Evidence check

The model must quote the contract for every flagged clause. `src/evidence.ts` then checks each
`evidence_quote` against the contract text without another model call: the quote's words must
appear in the contract in the same order, ignoring case, punctuation, typographic quotes and line
breaks, and a quote with an ellipsis must have each part present in order. Each clause gets an
`evidence_check`:

- `verified`: found word for word
- `approximate`: at least 85% of a quote of five or more words matches in order (shown with a warning)
- `not_found`: not located in the contract; the card says the finding is unverified

The server (`api/analyze.ts`) attaches the check before the analysis leaves it, so the JSON export
carries it too. Run the tests with `npm test`.

## Deploy on Vercel (free)

1. On vercel.com, choose **Add New → Project** and import this repository. Vercel detects Vite.
2. Under **Environment Variables**, add `GEMINI_API_KEY`.
3. Deploy. Analyses can take a minute or more on the Pro model; `vercel.json` gives the functions
   up to 300 seconds.

Optional: set `ANALYSIS_MODEL` (default `gemini-3.1-pro-preview`) or `CHAT_MODEL` (default
`gemini-3-flash-preview`) to use other Gemini models, for example a faster or cheaper one.
