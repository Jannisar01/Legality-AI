import { AnalysisResult } from './types';

export const mockAnalysisResult: AnalysisResult = {
  contract_type: "Service Agreement",
  overall_risk_score: 78,
  overall_risk_level: "High",
  executive_summary: "This contract heavily favors the counterparty, particularly regarding liability and intellectual property. The indemnification clause is unusually broad, and there is no cap on potential damages. Immediate renegotiation of the termination and IP ownership clauses is strongly recommended before signing.",
  risk_breakdown: [
    { category: "Payment", risk_level: "Low", explanation: "Standard payment terms with no major red flags." },
    { category: "Liability", risk_level: "High", explanation: "Unlimited liability for indirect damages." },
    { category: "Termination", risk_level: "High", explanation: "Very short notice period for termination for convenience." },
    { category: "Confidentiality", risk_level: "Medium", explanation: "Standard confidentiality, but lacks a time limit." },
    { category: "Intellectual Property", risk_level: "High", explanation: "Broad 'work for hire' clause may transfer pre-existing IP." },
    { category: "Indemnity", risk_level: "High", explanation: "Uncapped indemnification obligations." },
    { category: "Dispute Resolution", risk_level: "Medium", explanation: "Missing governing law clause." }
  ],
  flagged_clauses: [
    {
      clause_name: "Limitation of Liability",
      category: "Liability",
      risk_level: "High",
      issue: "Unlimited liability for indirect damages",
      what_it_means: "This clause states that you are responsible for any secondary or indirect losses the client suffers, without any financial cap.",
      why_it_matters: "Indirect damages can be massive and unpredictable, often far exceeding the value of the contract itself.",
      what_risk_it_creates: "You could be sued for millions if a small error on your part causes the client to lose a major business opportunity.",
      evidence_quote: "Provider shall be liable for any and all indirect, incidental, special, or consequential damages arising out of or relating to this Agreement.",
      recommendation: "Request a mutual waiver of consequential damages and a hard cap on direct damages (e.g., limited to fees paid in the last 12 months).",
      relevant_laws: ["Uniform Commercial Code (UCC) § 2-715", "Wisconsin Statutes Chapter 402"]
    },
    {
      clause_name: "Intellectual Property Rights",
      category: "Intellectual Property",
      risk_level: "High",
      issue: "Broad 'work for hire' assignment",
      what_it_means: "The client automatically owns everything you create or use while working for them.",
      why_it_matters: "This is a broad 'work for hire' clause that may accidentally transfer ownership of your pre-existing tools, templates, or background IP.",
      what_risk_it_creates: "You might lose the right to use your own foundational code or templates for future clients, severely impacting your business model.",
      evidence_quote: "All intellectual property rights in any materials created, developed, or provided by the Provider under this Agreement shall immediately vest in and become the exclusive property of the Client.",
      recommendation: "Carve out pre-existing IP. Grant a license to use pre-existing IP rather than transferring ownership.",
      relevant_laws: ["17 U.S. Code § 201 - Ownership of copyright", "Wisconsin Trade Secrets Act (Wis. Stat. § 134.90)"]
    },
    {
      clause_name: "Termination for Convenience",
      category: "Termination",
      risk_level: "Medium",
      issue: "Short notice period",
      what_it_means: "The client can cancel the contract at any time, for any reason, with only 5 days' warning.",
      why_it_matters: "A 5-day notice period for termination for convenience provides very little financial security or runway to reallocate resources.",
      what_risk_it_creates: "You could suddenly lose a major revenue stream without enough time to find replacement work, causing cash flow problems.",
      evidence_quote: "Client may terminate this Agreement at any time for convenience upon five (5) days written notice.",
      recommendation: "Negotiate a 30-day or 60-day notice period for termination for convenience.",
      relevant_laws: ["Wisconsin Fair Dealership Law (Wis. Stat. Ch. 135) - if applicable", "General principles of contract law regarding reasonable notice"]
    }
  ],
  missing_protections: [
    {
      missing_clause: "Late Payment Penalty",
      why_it_matters: "Without a late fee provision, the client has no financial incentive to pay invoices on time, potentially causing cash flow issues.",
      recommendation: "Add a 1.5% monthly late fee for invoices unpaid after 30 days."
    },
    {
      missing_clause: "Governing Law and Jurisdiction",
      why_it_matters: "If a dispute arises, it may be unclear which state or country's laws apply, leading to expensive jurisdictional battles.",
      recommendation: "Add a standard governing law and exclusive jurisdiction clause."
    }
  ],
  obligations_by_party: [
    {
      party: "Provider (You)",
      obligations: [
        "Deliver initial project roadmap and architecture documentation within 14 days of Effective Date.",
        "Maintain comprehensive general liability insurance of at least $1,000,000."
      ]
    },
    {
      party: "Client",
      obligations: [
        "Provide access to necessary internal APIs and staging environments prior to commencement of Phase 1."
      ]
    }
  ],
  negotiation_points: [
    "Cap total liability to the amount of fees paid under the contract.",
    "Add a mutual waiver of consequential and indirect damages.",
    "Explicitly exclude your pre-existing intellectual property from the assignment clause.",
    "Increase the termination for convenience notice period from 5 days to 30 days.",
    "Add a 1.5% monthly late fee for invoices unpaid after 30 days."
  ],
  disclaimer: "This tool provides informational screening only and is not legal advice."
};
