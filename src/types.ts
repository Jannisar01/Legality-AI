export type ContractType =
  | 'NDA'
  | 'Service Agreement'
  | 'Employment Agreement'
  | 'Vendor Agreement'
  | 'Lease'
  | 'Other';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type RiskCategory =
  | 'Payment'
  | 'Liability'
  | 'Termination'
  | 'Confidentiality'
  | 'Intellectual Property'
  | 'Indemnity'
  | 'Dispute Resolution'
  | 'Other';

export interface RiskBreakdown {
  category: RiskCategory;
  risk_level: RiskLevel;
  explanation: string;
}

export interface FlaggedClause {
  clause_name: string;
  category: string;
  risk_level: RiskLevel;
  issue: string;
  what_it_means: string;
  why_it_matters: string;
  what_risk_it_creates: string;
  evidence_quote: string;
  recommendation: string;
  relevant_laws: string[];
}

export interface MissingProtection {
  missing_clause: string;
  why_it_matters: string;
  recommendation: string;
}

export interface ObligationsByParty {
  party: string;
  obligations: string[];
}

export interface AnalysisResult {
  contract_type: string;
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  executive_summary: string;
  risk_breakdown: RiskBreakdown[];
  flagged_clauses: FlaggedClause[];
  missing_protections: MissingProtection[];
  obligations_by_party: ObligationsByParty[];
  negotiation_points: string[];
  disclaimer: string;
}
