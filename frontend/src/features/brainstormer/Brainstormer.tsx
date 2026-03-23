import React, { useState } from 'react';
import { Lightbulb, Zap, Sparkles, Copy, RefreshCw } from 'lucide-react';
import { brainstormIdeas } from '../../services/aiService';
import { getUserFacingAiError } from '../../services/errorUtils';
import { saveAIInteraction } from '../../services/interactionService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const Brainstormer: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBrainstorm = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setIdeas([]);
    try {
      const response = await brainstormIdeas(topic);
      const ideasList = response.split('\n').filter(line => line.trim().length > 0);
      setIdeas(ideasList);

      // Save interaction to Firestore
      await saveAIInteraction('Brainstormer', topic, response);
    } catch (error) {
      console.error(error);
      alert(getUserFacingAiError(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="h-full flex flex-col p-8 max-w-5xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-500/5 text-amber-500 mb-2 border border-amber-500/10">
            <Lightbulb size={28} />
          </div>
          <h2 className="heading-xl text-text-primary tracking-tight">Creative Spark</h2>
          <p className="body-main text-text-secondary max-w-lg mx-auto">
            Generate innovative ideas, names, or strategies powered by Nexus AI lateral thinking.
          </p>
        </header>

        <div className="max-w-2xl mx-auto w-full space-y-8">
          <Card className="p-1.5 flex items-center gap-2 bg-surface border-border pl-4 shadow-sm">
            <Zap className="text-amber-500 shrink-0" size={20} />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()}
              placeholder="What do you need ideas for?"
              className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary h-10 text-sm"
            />
            <Button
              onClick={handleBrainstorm}
              isLoading={isGenerating}
              disabled={!topic.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-none"
            >
              Generate <Sparkles className="ml-2 w-4 h-4" />
            </Button>
          </Card>

          {ideas.length > 0 && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {ideas.map((idea, index) => (
                <div
                  key={index}
                  className="group flex items-start justify-between p-5 rounded-2xl bg-surface border border-border hover:border-amber-500/20 transition-all duration-200 shadow-sm"
                >
                  <div className="flex gap-4">
                    <span className="text-amber-500/40 font-mono text-xs mt-1">{(index + 1).toString().padStart(2, '0')}</span>
                    <p className="body-sm text-text-secondary group-hover:text-text-primary transition-colors leading-relaxed">{idea.replace(/^[\d\-\.\*]+\s*/, '')}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(idea)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-text-tertiary hover:text-text-primary transition-all duration-200"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ))}

              <div className="flex justify-center pt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBrainstorm}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <RefreshCw size={14} className="mr-2" /> Regenerate Ideas
                </Button>
              </div>
            </div>
          )}

          {!ideas.length && !isGenerating && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-12">
              <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/30 cursor-pointer transition-all duration-200 shadow-sm" onClick={() => setTopic("Startup ideas for 2026")}>
                <p className="caption font-bold uppercase tracking-widest text-text-tertiary mb-2">Startup</p>
                <p className="body-sm text-text-secondary">"New ventures for 2026"</p>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/30 cursor-pointer transition-all duration-200 shadow-sm" onClick={() => setTopic("Blog post titles about AI")}>
                <p className="caption font-bold uppercase tracking-widest text-text-tertiary mb-2">Content</p>
                <p className="body-sm text-text-secondary">"Blog titles about AI"</p>
              </div>
              <div className="p-5 rounded-2xl border border-border bg-surface hover:border-primary/30 cursor-pointer transition-all duration-200 shadow-sm" onClick={() => setTopic("Youtube channel names for gaming")}>
                <p className="caption font-bold uppercase tracking-widest text-text-tertiary mb-2">Social</p>
                <p className="body-sm text-text-secondary">"Gaming channel names"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Brainstormer;
