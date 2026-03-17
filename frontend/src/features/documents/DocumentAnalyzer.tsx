import React, { useState, useRef } from 'react';
import { FileText, Upload, ChevronRight, File, Loader2, Play, Paperclip } from 'lucide-react';
import { analyzeDocument } from '../../services/grokService';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    const textToAnalyze = attachedFile ? attachedFile.content : content;
    if (!textToAnalyze.trim()) return;
    setIsAnalyzing(true);
    try {
      const response = await analyzeDocument(textToAnalyze);
      const parsed = JSON.parse(response);
      setResult(parsed);
    } catch (error) {
      console.error(error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractTextFromPPTX = async (file: File): Promise<string> => {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      let fullText = '';

      // Look for slide XML files
      const slideFiles = Object.keys(content.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));

      for (const slideName of slideFiles) {
        const xmlContent = await content.file(slideName)?.async('string');
        if (xmlContent) {
          // Extremely basic regex to extract text from a:t tags
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
        // Plain text files
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
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 text-sm text-gray-200 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <span className="text-primary font-mono select-none">{String(i + 1).padStart(2, '0')}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-6 max-w-7xl mx-auto">
      {/* Input Section */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <header>
          <h2 className="text-2xl font-bold text-white tracking-tight">Doc Analyzer</h2>
          <p className="text-sm text-gray-400 mt-1">Extract structured insights from raw text or document files.</p>
        </header>

        <Card className="flex-1 flex flex-col p-4 bg-background/50 overflow-hidden relative">
          {attachedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <button
                onClick={removeAttachment}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                title="Remove attachment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="text-primary" size={32} />
              </div>
              <span className="text-white font-medium text-sm text-center max-w-[80%] truncate">{attachedFile.name}</span>
              <span className="text-xs text-gray-400 mt-1">{(attachedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <textarea
              className="flex-1 bg-transparent resize-none border-none outline-none text-sm text-gray-300 placeholder:text-gray-600 custom-scrollbar"
              placeholder="Paste document text here or attach a text file..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md,.csv,.json,.js,.ts,.html,.css,text/*,.docx,.pptx,.xlsx,.xls"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                title="Attach text document"
              >
                <Paperclip size={18} />
              </button>
              <span className="text-xs text-gray-500">
                {attachedFile ? `${attachedFile.content.length} chars` : `${content.length} chars`}
              </span>
            </div>
            <Button
              onClick={handleAnalyze}
              isLoading={isAnalyzing}
              disabled={(!content.trim() && !attachedFile)}
            >
              Analyze <Play className="ml-2 w-3 h-3" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {result ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Executive Summary */}
            <Card className="p-6 bg-linear-to-br from-primary/10 to-transparent border-primary/20">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FileText className="text-primary" size={20} />
                Executive Summary
              </h3>
              <p className="text-gray-200 leading-relaxed">{result.summary}</p>
            </Card>

            <div className="grid grid-cols-1 gap-8">
              <AnalysisSection title="Key Insights" items={result.keyPoints} color="secondary" />
              <AnalysisSection title="Action Items" items={result.actionItems} color="accent" />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 rotate-12">
              <FileText size={48} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Ready to Analyze</h3>
            <p className="text-gray-400 max-w-xs">Paste your document text on the left or attach a file to generate summary, insights, and action items.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentAnalyzer;
