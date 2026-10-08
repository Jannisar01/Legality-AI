import { Type } from '@google/genai';
import { gemini, route, text } from '../server/gemini';

export default route(async (body) => {
  const contractText = text(body, 'contractText');
  const contractType = text(body, 'contractType', false) || 'Contract';
  const ai = gemini();
  const response = await ai.models.generateContent({
    model: process.env.ANALYSIS_MODEL || "gemini-3.1-pro-preview",
    contents: `Analyze the following contract text. It is expected to be a ${contractType}. Follow the strict JSON schema provided.\n\nContract Text:\n${contractText}`,
    config: {
      systemInstruction: `You are an expert corporate lawyer specializing in United States Federal Law and Wisconsin State Law. You are acting as a contract screening assistant.

Analysis goals:
- identify risky clauses
- identify missing protections
- summarize obligations by party
- produce an executive summary
- suggest negotiation points
- assign an overall risk score from 0 to 100
- classify overall risk as Low, Medium, or High

Reason carefully about practical contract risk in business settings under US and Wisconsin law (e.g., Wisconsin Uniform Commercial Code, Wisconsin Business Corporation Law Chapter 180, Wisconsin employment laws). Focus especially on:
- one-sided liability
- unclear payment terms
- auto-renewal risk
- vague termination language
- missing IP ownership terms
- weak confidentiality definitions
- indemnity imbalance
- dispute resolution burdens
- unreasonable penalties
- lack of limitation of liability
- lack of notice/cure periods

For each issue, explain in plain business language:
- what the clause means
- why it matters
- what risk it creates
- what a user may want to review or negotiate (put this in recommendation)

Keep the tone concise, professional, and useful.

Critical rules:
- be conservative
- do not hallucinate
- do not assume clauses exist if they are not clearly present
- every flagged clause must include a direct evidence quote from the contract text
- if a common clause is absent, list it under missing_protections
- if evidence is unclear, say so explicitly
- do not give definitive legal advice
- use plain English explanations
- You MUST reference particular US and Wisconsin laws, statutes, and legal guidelines where applicable in your explanations.

Output must strictly follow the JSON schema already defined. Do not output markdown inside JSON.

Make the analysis robust for:
- NDAs
- service agreements
- vendor agreements
- employment agreements
- leases
- general business contracts`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          contract_type: { type: Type.STRING },
          overall_risk_score: { type: Type.INTEGER },
          overall_risk_level: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          executive_summary: { type: Type.STRING },
          risk_breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: "A descriptive name for the type of risk, e.g., Payment, Liability, Termination, Confidentiality, Data Privacy, etc." },
                risk_level: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                explanation: { type: Type.STRING }
              },
              required: ["category", "risk_level", "explanation"]
            }
          },
          flagged_clauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clause_name: { type: Type.STRING },
                category: { type: Type.STRING },
                risk_level: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                issue: { type: Type.STRING },
                what_it_means: { type: Type.STRING },
                why_it_matters: { type: Type.STRING },
                what_risk_it_creates: { type: Type.STRING },
                evidence_quote: { type: Type.STRING },
                recommendation: { type: Type.STRING },
                relevant_laws: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific US or Wisconsin laws, statutes, or legal principles relevant to this clause." }
              },
              required: ["clause_name", "category", "risk_level", "issue", "what_it_means", "why_it_matters", "what_risk_it_creates", "evidence_quote", "recommendation", "relevant_laws"]
            }
          },
          missing_protections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                missing_clause: { type: Type.STRING },
                why_it_matters: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ["missing_clause", "why_it_matters", "recommendation"]
            }
          },
          obligations_by_party: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                party: { type: Type.STRING },
                obligations: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["party", "obligations"]
            }
          },
          negotiation_points: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          disclaimer: { type: Type.STRING }
        },
        required: ["contract_type", "overall_risk_score", "overall_risk_level", "executive_summary", "risk_breakdown", "flagged_clauses", "missing_protections", "obligations_by_party", "negotiation_points", "disclaimer"]
      }
    }
  });
  return { text: response.text };
});
