import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { callApi } from './api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import {
  ShieldAlert,
  FileText,
  Upload,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  FileWarning,
  Briefcase,
  ChevronRight,
  Loader2,
  ArrowRight,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Sparkles,
  PenTool,
  FileUp,
  X
} from 'lucide-react';
import { ContractType, AnalysisResult, RiskLevel, FlaggedClause, MissingProtection, ObligationsByParty } from './types';
import { mockAnalysisResult } from './mockData';
import { attachEvidenceChecks, evidenceSummary } from './evidence';

const contractTypes: ContractType[] = [
  'NDA',
  'Service Agreement',
  'Employment Agreement',
  'Vendor Agreement',
  'Lease',
  'Other'
];

// Animation variants for staggered list
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// Gemini answers in light Markdown. Show **bold** as bold and "* " list markers as bullets
// instead of printing the raw symbols; everything else stays plain text.
function FormattedText({ text }: { text: string }) {
  const lines = text.replace(/^\s*[*-]\s+/gm, '• ');
  return (
    <>
      {lines.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function App() {
  const [contractText, setContractText] = useState('');
  const [contractType, setContractType] = useState<ContractType>('Service Agreement');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New layout state
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [taggedContext, setTaggedContext] = useState<string | null>(null);

  // Revision state
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  const hasStarted = isAnalyzing || result !== null;

  const [isChatLoading, setIsChatLoading] = useState(false);
  const ownVersionInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (directMessage?: string) => {
    const messageToSend = typeof directMessage === 'string' ? directMessage : chatInput.trim();
    if (!messageToSend && !taggedContext) return;
    
    const context = taggedContext;
    
    const newMessage = context 
      ? `[Regarding: ${context}]\n${messageToSend}`
      : messageToSend;
      
    setChatMessages(prev => [...prev, { role: 'user', content: newMessage }]);
    if (!directMessage) setChatInput('');
    setTaggedContext(null);
    setIsChatLoading(true);
    
    try {
      // @ts-ignore
      const response = await callApi('/api/chat', {
        message: messageToSend,
        context,
        summary: result?.executive_summary,
      });

      setChatMessages(prev => [...prev, { role: 'ai', content: response.text || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', content: "I encountered an error while processing your request. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateSummary = () => {
    setIsChatExpanded(true);
    handleSendMessage("Please generate a concise summary of the analyzed report.");
  };

  const handleSuggestedEdits = () => {
    setIsChatExpanded(true);
    handleSendMessage("Please provide suggested edits and negotiation points based on the analyzed report.");
  };

  const handleOwnVersionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let fullText = '';
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
      } catch (error) {
        console.error('Error parsing PDF:', error);
        alert('Failed to parse PDF file.');
        return;
      }
    } else {
      const text = await file.text();
      fullText = text;
    }
    
    if (ownVersionInputRef.current) {
      ownVersionInputRef.current.value = '';
    }

    setIsChatExpanded(true);
    handleSendMessage(`Here is my own version of the contract. Please re-analyze how it gives me leverage against the original.\n\nMy Version:\n${fullText}`);
  };

  const handleTagContext = (context: string) => {
    setTaggedContext(context);
    setIsChatExpanded(true);
  };

  const handleDownloadAnalysis = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "contract_analysis.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleReviseContract = async () => {
    if (!contractText.trim() || !revisionInstructions.trim()) return;
    setIsRevising(true);
    
    try {
      // @ts-ignore
      const response = await callApi('/api/revise', { instructions: revisionInstructions, contractText });

      const revisedText = response.text;
      if (revisedText) {
        const doc = new jsPDF();
        
        // Basic text wrapping for jsPDF
        const splitText = doc.splitTextToSize(revisedText, 180);
        let y = 20;
        for (let i = 0; i < splitText.length; i++) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(splitText[i], 15, y);
          y += 7;
        }
        
        doc.save("revised_contract.pdf");
        setShowReviseModal(false);
        setRevisionInstructions('');
      }
    } catch (error) {
      console.error("Revision failed:", error);
      alert("Failed to generate revised contract. Please try again.");
    } finally {
      setIsRevising(false);
    }
  };

  const handleAnalyze = async () => {
    if (!contractText.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    setIsInputExpanded(false);
    setIsChatExpanded(true);
    
    try {
      // @ts-ignore
      const response = await callApi('/api/analyze', { contractType, contractText });

      if (response.text) {
        const parsed: AnalysisResult = JSON.parse(response.text);
        // the server attaches evidence checks; fill them in here if it did not
        const checked = parsed.flagged_clauses?.every((c) => c.evidence_check)
          ? parsed
          : attachEvidenceChecks(parsed, contractText);
        setResult(checked);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Please check the console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        setContractText(fullText.trim());
      } catch (error) {
        console.error('Error parsing PDF:', error);
        alert('Failed to parse PDF file. Please try another file or paste the text directly.');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          setContractText(text);
        }
      };
      reader.readAsText(file);
    }
    
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-teal-500/30 relative overflow-hidden">
      {/* Atmospheric Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/60 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500/20 to-teal-500/5 rounded-xl border border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <Scale className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg tracking-tight text-white leading-tight">AI Contract Risk Detector</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">🇺🇸 US & WI Corporate Law Edition</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#" className="hover:text-zinc-100 transition-colors">Documentation</a>
            <a href="#" className="hover:text-zinc-100 transition-colors">Support</a>
            <div className="w-px h-4 bg-zinc-800"></div>
            <button className="flex items-center gap-2 hover:text-white transition-colors">
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs border border-zinc-700">U</div>
            </button>
          </div>
        </div>
      </nav>

      <main className={`relative z-10 flex ${hasStarted ? 'h-[calc(100vh-64px)] overflow-hidden' : 'min-h-[calc(100vh-64px)] items-center justify-center p-6'}`}>
        {!hasStarted ? (
          <div className="w-full max-w-3xl space-y-8">
            {/* Hero Text */}
            <div className="text-center">
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight mb-4">
                Screen documents in <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">seconds</span>.
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed font-light">
                Instantly identify risky clauses, missing protections, and hidden obligations before you sign.
              </p>
            </div>

            {/* Input Card */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Document Type
                  </label>
                  <div className="relative group">
                    <select
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value as ContractType)}
                      className="w-full appearance-none bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-5 pr-10 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all hover:bg-zinc-900/80 cursor-pointer"
                    >
                      {contractTypes.map((type) => (
                        <option key={type} value={type} className="bg-zinc-900">{type}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Document Text
                    </label>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors bg-teal-500/10 px-3 py-1.5 rounded-full border border-teal-500/20 hover:bg-teal-500/20"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Document
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".txt,.md,.csv,.pdf" 
                      className="hidden" 
                    />
                  </div>
                  <textarea
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder="Paste document text or upload a file..."
                    className="w-full h-[320px] bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all resize-none font-mono text-sm leading-relaxed custom-scrollbar shadow-inner"
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !contractText.trim()}
                  className="group w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                      Analyzing Document...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Analyze Document
                      <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </>
                  )}
                </button>
                
                <div className="flex items-start gap-2 text-zinc-500 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                  <p className="text-xs leading-relaxed">
                    This tool provides informational screening only and is not legal advice. Always consult with a qualified attorney before signing binding agreements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full h-full overflow-hidden">
            
            {/* Left Sidebar (Input) */}
            <motion.div 
              initial={false}
              animate={{ width: isInputExpanded ? 400 : 64 }}
              className="h-full border-r border-white/5 bg-[#050505]/80 backdrop-blur-xl flex-shrink-0 flex flex-col z-20"
            >
              <div className="h-14 flex items-center justify-end px-4 border-b border-white/5">
                <button onClick={() => setIsInputExpanded(!isInputExpanded)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  {isInputExpanded ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </button>
              </div>
              
              <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${!isInputExpanded && 'hidden'}`}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                      Document Type
                    </label>
                    <div className="relative group">
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value as ContractType)}
                        className="w-full appearance-none bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-5 pr-10 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all hover:bg-zinc-900/80 cursor-pointer"
                      >
                        {contractTypes.map((type) => (
                          <option key={type} value={type} className="bg-zinc-900">{type}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Document Text
                      </label>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors bg-teal-500/10 px-3 py-1.5 rounded-full border border-teal-500/20 hover:bg-teal-500/20"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".txt,.md,.csv,.pdf" 
                        className="hidden" 
                      />
                    </div>
                    <textarea
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                      placeholder="Paste document text or upload a file..."
                      className="w-full h-[400px] bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all resize-none font-mono text-sm leading-relaxed custom-scrollbar shadow-inner"
                    />
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !contractText.trim()}
                    className="group w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Re-Analyze
                        <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Middle Area (Results) */}
            <div className="flex-1 h-full overflow-y-auto custom-scrollbar relative flex flex-col">
              
              {/* Top Action Panel */}
              {result && !isAnalyzing && (
                <div className="sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 p-4 flex flex-wrap items-center justify-center gap-3">
                  <button onClick={handleGenerateSummary} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-zinc-300 transition-colors">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    Summarize
                  </button>
                  <button onClick={handleSuggestedEdits} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-zinc-300 transition-colors">
                    <PenTool className="w-4 h-4 text-amber-400" />
                    Suggest Edits
                  </button>
                  <button onClick={() => ownVersionInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-zinc-300 transition-colors">
                    <FileUp className="w-4 h-4 text-blue-400" />
                    Compare Version
                  </button>
                  <button onClick={handleDownloadAnalysis} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-zinc-300 transition-colors">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Export JSON
                  </button>
                  <button onClick={() => setShowReviseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded-full text-sm font-medium text-teal-300 transition-colors">
                    <FileText className="w-4 h-4" />
                    Revise & Export PDF
                  </button>
                  <input 
                    type="file" 
                    ref={ownVersionInputRef} 
                    onChange={handleOwnVersionUpload} 
                    accept=".txt,.md,.csv,.pdf" 
                    className="hidden" 
                  />
                </div>
              )}

              <div className="flex-1 p-6 lg:p-10 max-w-4xl mx-auto w-full">
                <AnimatePresence mode="wait">
                  {isAnalyzing && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4 }}
                      className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 glass-panel rounded-3xl relative overflow-hidden"
                    >
                      {/* Scanning effect */}
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/10 to-transparent w-full h-[200%]"
                        animate={{ top: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      />
                      
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="relative mb-8">
                          <div className="w-24 h-24 border border-zinc-800 rounded-3xl bg-zinc-900/50 flex items-center justify-center shadow-2xl">
                            <FileText className="w-10 h-10 text-teal-500/50" />
                          </div>
                          {/* Glowing scanner line */}
                          <motion.div 
                            className="absolute left-0 right-0 h-0.5 bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          />
                        </div>
                        <h3 className="text-2xl font-medium text-white mb-3 font-serif">Analyzing Document</h3>
                        <div className="flex flex-col items-center gap-2 text-sm text-zinc-400 font-mono">
                          <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}>Extracting clauses...</motion.span>
                          <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}>Identifying liabilities...</motion.span>
                          <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 1 }}>Checking for missing protections...</motion.span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {result && !isAnalyzing && (
                    <motion.div
                      key="results"
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-6"
                    >
                      {/* Dashboard Stats Row */}
                      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-zinc-900/50 border border-white/5 flex items-center justify-center shadow-inner">
                            <FileText className="w-5 h-5 text-teal-400" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Document Type</span>
                            <span className="text-sm font-medium text-zinc-200">{result.contract_type}</span>
                          </div>
                        </div>
                        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-inner">
                            <FileWarning className="w-5 h-5 text-rose-400" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Flagged Issues</span>
                            <span className="text-sm font-medium text-zinc-200">{result.flagged_clauses.length} Found</span>
                          </div>
                        </div>
                        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner">
                            <ShieldAlert className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Missing Clauses</span>
                            <span className="text-sm font-medium text-zinc-200">{result.missing_protections.length} Missing</span>
                          </div>
                        </div>
                      </motion.div>

                  {/* Score & Summary Card */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8 relative overflow-hidden">
                    {/* Subtle background glow based on score */}
                    <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${
                      result.overall_risk_level === 'High' ? 'bg-rose-500' : 
                      result.overall_risk_level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    
                    <div className="flex flex-col sm:flex-row gap-8 items-start relative z-10">
                      <div className="flex-shrink-0 flex flex-col items-center justify-center w-36 h-36 rounded-full bg-zinc-950/50 border border-white/5 relative shadow-2xl">
                        <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                          <motion.circle 
                            cx="50" cy="50" r="46" fill="none" 
                            stroke="currentColor" 
                            strokeWidth="6" 
                            strokeLinecap="round"
                            className={
                              result.overall_risk_level === 'High' ? 'text-rose-500' : 
                              result.overall_risk_level === 'Medium' ? 'text-amber-500' : 'text-emerald-500'
                            }
                            initial={{ strokeDasharray: "0 289" }}
                            animate={{ strokeDasharray: `${result.overall_risk_score * 2.89} 289` }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                          />
                        </svg>
                        <span className="text-5xl font-light text-white tracking-tighter">{result.overall_risk_score}</span>
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mt-1">Risk Score</span>
                      </div>
                      
                      <div className="flex-1 pt-2">
                        <div className="flex items-center gap-4 mb-4">
                          <h2 className="text-2xl font-serif text-white">Executive Summary</h2>
                          <Badge level={result.overall_risk_level} />
                        </div>
                        <p className="text-zinc-300 leading-relaxed text-[15px]">
                          {result.executive_summary}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Risk Breakdown */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                        <AlertTriangle className="w-4 h-4 text-zinc-300" />
                      </div>
                      Risk Assessment
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      {result.risk_breakdown.map((item) => (
                        <div key={item.category} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-zinc-300">{item.category}</span>
                            <span className="text-xs font-mono text-zinc-500">{item.risk_level}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: item.risk_level === 'High' ? '100%' : item.risk_level === 'Medium' ? '60%' : '20%' }}
                                transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                                className={`h-full rounded-full ${getLevelColor(item.risk_level)} shadow-[0_0_10px_currentColor] opacity-80`}
                              />
                            </div>
                            <div className="w-16 flex justify-end">
                              <Badge level={item.risk_level} small />
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Flagged Clauses */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                          <FileWarning className="w-4 h-4 text-rose-400" />
                        </div>
                        Flagged Issues
                      </h3>
                      <span className="text-xs font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/5 text-zinc-400">
                        {result.flagged_clauses.length} Issues Found
                      </span>
                    </div>
                    <EvidenceSummaryLine result={result} />
                    
                    <div className="space-y-4">
                      {result.flagged_clauses.map((clause, i) => (
                        <FlaggedClauseItem key={i} clause={clause} onTag={handleTagContext} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Missing Protections */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                        </div>
                        Missing Clauses
                      </h3>
                      <span className="text-xs font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/5 text-zinc-400">
                        {result.missing_protections.length} Missing
                      </span>
                    </div>
                    <div className="space-y-4">
                      {result.missing_protections.map((mp, i) => (
                        <MissingProtectionItem key={i} mp={mp} onTag={handleTagContext} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Obligations */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <Briefcase className="w-4 h-4 text-blue-400" />
                        </div>
                        Party Obligations
                      </h3>
                      <span className="text-xs font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/5 text-zinc-400">
                        {result.obligations_by_party.length} Parties
                      </span>
                    </div>
                    <div className="space-y-4">
                      {result.obligations_by_party.map((ob, i) => (
                        <ObligationItem key={i} ob={ob} onTag={handleTagContext} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Negotiation Points */}
                  <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      </div>
                      Negotiation Strategy
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {result.negotiation_points.map((point, i) => (
                        <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-zinc-900/40 border border-white/5 glass-panel-hover">
                          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center text-sm font-bold shrink-0 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                            {i + 1}
                          </div>
                          <span className="text-sm text-zinc-300 leading-relaxed pt-1">{point}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                  
                  <div className="text-center text-xs text-zinc-500 mt-8">
                    {result.disclaimer}
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Sidebar (Chat) */}
        {hasStarted && (
          <motion.div 
            initial={false}
            animate={{ width: isChatExpanded ? 400 : 64 }}
            className="h-full border-l border-white/5 bg-[#050505]/80 backdrop-blur-xl flex-shrink-0 flex flex-col z-20"
          >
            <div className="h-14 flex items-center px-4 border-b border-white/5">
              <button onClick={() => setIsChatExpanded(!isChatExpanded)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                {isChatExpanded ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
              </button>
              {isChatExpanded && <span className="ml-3 font-medium text-zinc-200">Legal Assistant</span>}
            </div>
            
            <div className={`flex-1 flex flex-col overflow-hidden ${!isChatExpanded && 'hidden'}`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="text-center text-zinc-500 text-sm mt-10 px-4">
                    Ask questions about the document or select text from the report to discuss.
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-teal-500/20 text-teal-100 border border-teal-500/30' : 'bg-zinc-900/80 text-zinc-300 border border-white/5'}`}>
                      <span className="whitespace-pre-wrap"><FormattedText text={msg.content} /></span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="p-4 border-t border-white/5 bg-[#050505]">
                {taggedContext && (
                  <div className="mb-3 p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-start justify-between gap-2">
                    <p className="text-xs text-teal-200 line-clamp-2 leading-relaxed">{taggedContext}</p>
                    <button onClick={() => setTaggedContext(null)} className="text-teal-400 hover:text-teal-300 p-1 hover:bg-teal-500/20 rounded-md transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="relative">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message assistant..."
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-4 pr-12 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={(!chatInput.trim() && !taggedContext) || isChatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-teal-500 text-zinc-950 rounded-lg hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    )}

    {/* Revise Modal */}
    <AnimatePresence>
      {showReviseModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <PenTool className="w-5 h-5 text-teal-400" />
                Revise & Export Document
              </h3>
              <button 
                onClick={() => setShowReviseModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Provide instructions for revision. The AI will apply these changes and generate a formatted PDF.
            </p>
            <textarea
              value={revisionInstructions}
              onChange={(e) => setRevisionInstructions(e.target.value)}
              placeholder="e.g., 'Change termination notice to 30 days and cap liability at $50,000.'"
              className="w-full h-32 bg-black/50 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReviseModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReviseContract}
                disabled={isRevising || !revisionInstructions.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRevising ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Export PDF
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </main>
</div>
  );
}

// Separate component for Flagged Clause to handle its own expanded state
const FlaggedClauseItem: React.FC<{ clause: FlaggedClause, onTag: (text: string) => void }> = ({ clause, onTag }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden transition-colors hover:bg-zinc-900/60">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <Badge level={clause.risk_level} />
          <span className="text-sm font-medium text-zinc-200">{clause.clause_name}</span>
          <span className="text-xs text-zinc-500 hidden sm:inline-block">({clause.category})</span>
          <EvidenceBadge clause={clause} />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onTag(`Clause: ${clause.clause_name} - ${clause.issue}`); }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors text-xs font-medium border border-teal-500/20"
          >
            <MessageSquare className="w-3 h-3" /> Discuss
          </button>
          <span className="text-xs text-zinc-500 font-medium">{isOpen ? 'Collapse' : 'Expand'}</span>
          <div className={`p-1 rounded-full bg-white/5 border border-white/5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 border-t border-white/5 mt-2">
              <div className="my-4 p-4 bg-[#050505]/50 rounded-xl border border-zinc-800/50 font-mono text-[13px] text-zinc-400 leading-relaxed border-l-2 border-l-rose-500/50 shadow-inner">
                "{clause.evidence_quote}"
              </div>
              <EvidenceNote clause={clause} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Issue: {clause.issue}
                  </span>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">What it means:</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{clause.what_it_means}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">Why it matters:</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{clause.why_it_matters}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">Risk created:</span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{clause.what_risk_it_creates}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Suggestion
                  </span>
                  <p className="text-sm text-zinc-300 leading-relaxed mb-4">{clause.recommendation}</p>
                  
                  {clause.relevant_laws && clause.relevant_laws.length > 0 && (
                    <div>
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
                        <Scale className="w-3.5 h-3.5" /> Relevant Laws (US/WI)
                      </span>
                      <ul className="space-y-1.5">
                        {clause.relevant_laws.map((law, idx) => (
                          <li key={idx} className="text-xs text-zinc-400 flex items-start gap-2">
                            <span className="text-indigo-500/50 mt-0.5">•</span>
                            {law}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ level, small = false }: { level: RiskLevel; small?: boolean }) {
  const styles = {
    High: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  };

  return (
    <span className={`inline-flex items-center justify-center border font-semibold rounded-full backdrop-blur-md ${styles[level]} ${small ? 'px-2 py-0.5 text-[10px] tracking-wide' : 'px-3 py-1 text-xs tracking-wide'}`}>
      {level} Risk
    </span>
  );
}

const MissingProtectionItem: React.FC<{ mp: MissingProtection, onTag: (text: string) => void }> = ({ mp, onTag }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden transition-colors hover:bg-zinc-900/60">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-medium text-zinc-200">{mp.missing_clause}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onTag(`Missing Protection: ${mp.missing_clause}`); }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors text-xs font-medium border border-teal-500/20"
          >
            <MessageSquare className="w-3 h-3" /> Discuss
          </button>
          <span className="text-xs text-zinc-500 font-medium">{isOpen ? 'Collapse' : 'Expand'}</span>
          <div className={`p-1 rounded-full bg-white/5 border border-white/5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 border-t border-white/5 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                <div>
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    <Info className="w-3.5 h-3.5" /> Why it matters
                  </span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{mp.why_it_matters}</p>
                </div>
                <div>
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Recommendation
                  </span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{mp.recommendation}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ObligationItem: React.FC<{ ob: ObligationsByParty, onTag: (text: string) => void }> = ({ ob, onTag }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden transition-colors hover:bg-zinc-900/60">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-zinc-200">{ob.party}</span>
          <span className="text-xs font-semibold bg-white/5 px-2 py-0.5 rounded-full border border-white/5 text-zinc-400">
            {ob.obligations.length} {ob.obligations.length === 1 ? 'Task' : 'Tasks'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onTag(`Obligations for ${ob.party}`); }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors text-xs font-medium border border-teal-500/20"
          >
            <MessageSquare className="w-3 h-3" /> Discuss
          </button>
          <span className="text-xs text-zinc-500 font-medium">{isOpen ? 'Collapse' : 'Expand'}</span>
          <div className={`p-1 rounded-full bg-white/5 border border-white/5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 border-t border-white/5 mt-2">
              <ul className="mt-4 space-y-3">
                {ob.obligations.map((o, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-300 leading-relaxed">{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getLevelColor(level: RiskLevel) {
  switch (level) {
    case 'High': return 'bg-rose-500';
    case 'Medium': return 'bg-amber-500';
    case 'Low': return 'bg-emerald-500';
    default: return 'bg-zinc-500';
  }
}


// Shows whether the quoted evidence was found in the contract text (see src/evidence.ts).
const EvidenceBadge: React.FC<{ clause: FlaggedClause }> = ({ clause }) => {
  const check = clause.evidence_check;
  if (!check || check.status === 'verified') {
    return check ? (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
        Quote verified
      </span>
    ) : null;
  }
  if (check.status === 'approximate') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Quote approximate ({Math.round(check.score * 100)}%)
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
      Quote not found in contract
    </span>
  );
};

const EvidenceNote: React.FC<{ clause: FlaggedClause }> = ({ clause }) => {
  const check = clause.evidence_check;
  if (!check || check.status === 'verified') return null;
  const text =
    check.status === 'approximate'
      ? `This quote matches the contract only approximately (${Math.round(check.score * 100)}% of its words, in order). Compare it with the contract before relying on it.`
      : 'This quote could not be found in the contract text. The model may have paraphrased or invented it, so treat this finding as unverified until you locate the clause yourself.';
  return (
    <p
      className={`-mt-2 mb-4 text-xs leading-relaxed ${check.status === 'approximate' ? 'text-amber-400/90' : 'text-rose-400/90'}`}
    >
      {text}
    </p>
  );
};

const EvidenceSummaryLine: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  if (!result.flagged_clauses.some((c) => c.evidence_check)) return null;
  const counts = evidenceSummary(result);
  const total = result.flagged_clauses.length;
  return (
    <p className="-mt-3 mb-5 text-xs text-zinc-500">
      Evidence check: {counts.verified} of {total} quotes found word for word in the contract
      {counts.approximate > 0 && `, ${counts.approximate} approximate`}
      {counts.not_found > 0 && `, ${counts.not_found} not found`}.
    </p>
  );
};
