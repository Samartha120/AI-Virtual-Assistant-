import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, FileSearch, MessageSquare, X, Plus, Trash2, Database, Loader2 } from 'lucide-react';
import { KnowledgeItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  fetchKnowledgeItems,
  createKnowledgeItem,
  deleteKnowledgeItem,
} from '../../services/firestoreService';
import { analyzeImage } from '../../services/aiService';
import { saveAIInteraction, logSystemEvent } from '../../services/interactionService';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const KnowledgeBase: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newItem, setNewItem] = useState<{ title: string; content: string; type: KnowledgeItem['type'] }>({
    title: '',
    content: '',
    type: 'research',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchKnowledgeItems();
        setItems(data);
      } catch (err) {
        console.error('Failed to load knowledge items:', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    logSystemEvent({ type: 'module', action: 'OPEN_KNOWLEDGE_BASE', module: 'knowledge_base' });
  }, []);

  const handleAdd = async () => {
    if (!newItem.title || !newItem.content) return;
    setIsLoading(true);
    try {
      // 1. First, save to the primary Knowledge Base collection
      const created = await createKnowledgeItem({
        title: newItem.title,
        content: newItem.content,
        type: newItem.type,
      });
      
      // 2. Immediately log this to the global AI Interactions collection for visibility
      // We await this to ensure it's stored before the UI updates
      await saveAIInteraction(
        'Knowledge Dataset: Add', 
        newItem.title, 
        `User added a new ${newItem.type} entry: ${newItem.title}. Content: ${newItem.content.slice(0, 2000)}...`
      );

      setItems((prev) => [created, ...prev]);
      setNewItem({ title: '', content: '', type: 'research' });
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to create knowledge item:', err);
      alert('Failed to save to database. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    let text = '';

    try {
      setIsLoading(true);
      if (['txt', 'md', 'csv', 'json', 'js', 'ts'].includes(extension || '')) {
        text = await file.text();
      } else if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
      } else if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
        // Handle images with Vision AI
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        text = await analyzeImage(base64, "Perform OCR and extract all text from this document image. If it is a research paper or notes, summarize the main points at the end.");
      } else {
        alert('Unsupported format. Please use TXT, MD, DOCX, XLSX, or an image (JPG/PNG).');
        return;
      }

      setNewItem({
        title: file.name.replace(/\.[^/.]+$/, ""),
        content: text,
        type: 'text'
      });
      setIsAdding(true);
    } catch (err) {
      console.error('File parse error:', err);
      alert('Failed to read file.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteKnowledgeItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete knowledge item:', err);
      alert('Failed to delete. Please try again.');
    }
  };

  return (
    <div 
      className="p-8 max-w-7xl mx-auto space-y-10 min-h-full"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="bg-surface p-10 rounded-full shadow-2xl scale-110">
            <Upload size={64} className="text-primary animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mt-6">Drop to add to Knowledge</h2>
          <p className="text-text-secondary mt-2">Release files to start analyzing</p>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary mb-1">
            <Database size={24} />
            <span className="caption font-bold uppercase tracking-widest">Enterprise Intelligence</span>
          </div>
          <h2 className="heading-xl text-text-primary tracking-tight">Knowledge Dataset</h2>
          <p className="body-main text-text-secondary max-w-2xl">
            Upload reference material, meeting notes, and research papers to ground NexusAI's generations in your private context.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            accept=".txt,.md,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="shadow-none border-border hover:border-primary/30"
          >
            <Upload size={18} className="mr-2" /> Upload File
          </Button>
          <Button
            onClick={() => setIsAdding(true)}
            className="shadow-md shadow-primary/10"
          >
            <Plus size={18} className="mr-2" /> Add Entry
          </Button>
        </div>
      </header>

      {isAdding && (
        <Card className="p-8 space-y-6 animate-in slide-in-from-top-4 duration-300 relative border-primary/20 bg-surface/50">
          <button 
            onClick={() => setIsAdding(false)} 
            className="absolute top-6 right-6 p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-muted rounded-xl transition-all"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="heading-lg text-text-primary">New Knowledge Entry</h3>
              <p className="caption text-text-tertiary uppercase tracking-wider">Define context for the AI</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="body-sm font-medium text-text-secondary">Document Title</label>
              <input
                type="text"
                placeholder="e.g., Marketing Q3 Strategy"
                value={newItem.title}
                onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="body-sm font-medium text-text-secondary">Category</label>
              <select
                value={newItem.type}
                onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none cursor-pointer"
              >
                <option value="research">Research Paper</option>
                <option value="meeting">Meeting Notes</option>
                <option value="text">General Document</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="body-sm font-medium text-text-secondary">Content</label>
            <textarea
              placeholder="Paste content or upload a document to populate..."
              value={newItem.content}
              onChange={e => setNewItem({ ...newItem, content: e.target.value })}
              className="w-full h-64 bg-input-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all resize-none custom-scrollbar leading-relaxed"
            />
          </div>

          <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
            <button 
              onClick={() => setIsAdding(false)} 
              className="body-sm font-medium text-text-tertiary hover:text-text-primary transition-colors"
            >
              Discard
            </button>
            <Button 
              onClick={handleAdd} 
              isLoading={isLoading}
              disabled={!newItem.title || !newItem.content}
              className="px-10"
            >
              Save to Intelligence Base
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {items.map(item => (
          <Card key={item.id} className="p-6 group relative hover:border-primary/30 transition-all duration-300 flex flex-col h-full bg-surface shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                item.type === 'research' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' : 
                item.type === 'meeting' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' : 
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
              }`}>
                {item.type === 'research' && <FileSearch size={12} />}
                {item.type === 'meeting' && <MessageSquare size={12} />}
                {item.type === 'text' && <FileText size={12} />}
                {item.type}
              </div>
              <button 
                onClick={() => deleteItem(item.id)} 
                className="opacity-0 group-hover:opacity-100 p-1.5 text-text-tertiary hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all duration-200"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <h4 className="heading-md text-text-primary mb-3 line-clamp-1 group-hover:text-primary transition-colors">{item.title}</h4>
            <p className="body-sm text-text-secondary line-clamp-4 leading-relaxed flex-1">{item.content}</p>
            
            <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              <span>{item.content.split(/\s+/).filter(Boolean).length} words</span>
              <span>{item.dateAdded}</span>
            </div>
          </Card>
        ))}
        
        {items.length === 0 && !isAdding && (
          <div className="col-span-full h-80 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[2.5rem] bg-surface/30 opacity-60">
            <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-6 text-text-tertiary">
              <Database size={32} />
            </div>
            <p className="heading-md text-text-primary">Intelligence Dataset Empty</p>
            <p className="body-sm text-text-secondary mt-2 text-center max-w-sm">
              Drag and drop files or add manual entries to help NexusAI understand your private context.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
