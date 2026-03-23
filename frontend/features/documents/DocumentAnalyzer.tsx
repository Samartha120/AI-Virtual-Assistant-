/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Loader2, Play, Paperclip, History } from 'lucide-react';
import { askNexus } from '../../services/aiService';
import { AnalysisResult } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const DocumentAnalyzer: React.FC = () => {
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string, content: string, size: number } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    const textToAnalyze = attachedFile ? attachedFile.content : content;
    if (!textToAnalyze.trim()) return;
    setIsAnalyzing(true);
    try {
      const resp = await askNexus(textToAnalyze, 'doc_analyzer', currentSessionId);
      if (!currentSessionId) setCurrentSessionId(resp.sessionId);

      const response = resp.reply;
      let parsed;
      try {
        parsed = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (e) {
        console.warn('JSON parse failed, attempting cleanup', e);
        const cleaned = response.replace(/```json\s*/i, '').replace(/```\s*/i, '').replace(/\s*```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      setResult(parsed);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. The AI returned an unexpected format. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractTextFromPPTX = async (file: File): Promise<string> => {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      let fullText = '';
      const slideFiles = Object.keys(content.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
      for (const slideName of slideFiles) {
        const xmlContent = await content.file(slideName)?.async('string');
        if (xmlContent) {
          const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
            fullText += slideText + '\n\n';
          }
        }
      }
      return fullText.trim();
    } catch (error) {
      console.error('PPTX extraction error', error);
      throw new Error('Failed to extract text from Presentation.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    let extractedText = '';

    try {
      if (['txt', 'md', 'csv', 'json', 'js', 'ts', 'html', 'css'].includes(extension || '')) {
        extractedText = await file.text();
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        extractedText = XLSX.utils.sheet_to_csv(worksheet);
      } else if (extension === 'pptx') {
        extractedText = await extractTextFromPPTX(file);
      } else {
        alert('Unsupported file format. Please upload TXT, MD, DOCX, XLSX, or PPTX.');
        return;
      }

      setAttachedFile({
        name: file.name,
        content: extractedText,
        size: file.size
      });

    } catch (err) {
      console.error('File parsing error', err);
      alert('Failed to parse the file. It might be corrupted or in an unsupported format.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
  };

  const AnalysisSection = ({ title, items, color = "primary" }: { title: string, items: string[], color?: "primary" | "secondary" | "accent" }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${color === 'primary' ? 'bg-primary' : color === 'secondary' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        {title}
      </h3>
      <div className="space-y-2">
        {(Array.isArray(items) ? items : []).map((item, i) => (
          <div key={i} className="flex gap-3 text-sm text-gray-200 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <span className="text-primary font-mono select-none">{String(i + 1).padStart(2, '0')}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-6 max-w-7xl mx-auto relative">
      {/* Container spacing */}

      {/* Input Section */}
      <div className="w-full md:w-1/3 flex flex-col gap-4 mt-12 md:mt-0">
        <header>
          <h2 className="text-2xl font-bold text-white tracking-tight">Doc Analyzer</h2>
          <p className="text-sm text-gray-400 mt-1">Extract structured insights from raw text or document files.</p>
        </header>

        <Card className="flex-1 flex flex-col p-4 bg-background/50 overflow-hidden relative">
          {attachedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1 truncate max-w-full px-4">{attachedFile.name}</h3>
              <p className="text-sm text-gray-400 mb-6">{(attachedFile.size / 1024).toFixed(1)} KB</p>
              
              <div className="w-full h-px bg-white/5 mb-6" />
              
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-8">
                <div className="flex items-center gap-1.5">
                  <Paperclip size={14} />
                  <span>{attachedFile.content.length} chars</span>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <Button variant="secondary" className="flex-1" onClick={removeAttachment}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAnalyze} isLoading={isAnalyzing}>
                  Analyze <Play size={14} className="ml-2 fill-current" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your document text here..."
                className="flex-1 w-full bg-transparent border-none outline-none text-sm text-gray-300 placeholder:text-gray-600 resize-none custom-scrollbar leading-relaxed"
              />
              
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.md,.docx,.xlsx,.xls,.csv,.pptx"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Attach file"
                >
                  <Paperclip size={20} />
                </button>
                
                <Button 
                  onClick={handleAnalyze} 
                  isLoading={isAnalyzing} 
                  disabled={!content.trim()}
                  className="px-6"
                >
                  Analyze <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Result Section */}
      <div className="flex-1 flex flex-col gap-4 mt-12 md:mt-0">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileText size={20} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Analysis Output</h2>
          </div>
          {result && (
            <button 
              onClick={() => { setContent(''); setResult(null); setAttachedFile(null); }}
              className="text-xs text-gray-500 hover:text-white transition-colors mr-24"
            >
              Clear Analysis
            </button>
          )}
        </header>

        <Card className="flex-1 p-6 bg-background/50 overflow-y-auto custom-scrollbar">
          {!result && !isAnalyzing && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 grayscale group hover:grayscale-0 transition-all duration-500">
              <div className="w-20 h-20 rounded-4xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:border-primary/30 transition-colors">
                <FileText size={40} className="text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ready to Analyze</h3>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed px-4">
                Paste your document text on the left or attach a file to generate summaries, insights, and action items.
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse rounded-full" />
                <Loader2 size={48} className="text-primary animate-spin relative z-10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Analyzing Intelligence...</h3>
              <p className="text-sm text-gray-400 animate-pulse">Our neural link is processing your document</p>
            </div>
          )}

          {result && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Executive Summary
                </h3>
                <p className="text-lg text-white leading-relaxed font-medium">
                  {result.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalysisSection title="Key Insights" items={result.keyPoints} color="secondary" />
                <AnalysisSection title="Action Items" items={result.actionItems} color="accent" />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DocumentAnalyzer;
