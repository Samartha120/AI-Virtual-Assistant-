import React, { useState } from 'react';
import { Lightbulb, Zap, Sparkles, Copy, RefreshCw } from 'lucide-react';
import { brainstormIdeas } from '../../services/geminiService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const Brainstormer: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBrainstorm = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setIdeas([]); // Clear previous
    try {
      const response = await brainstormIdeas(topic);
      // Clean up response if it has numbered list formatting, though service might handle it.
      // Assuming response is a raw string, let's split by newlines if it looks like a list
      // or just trust the display.
      // The service returns a string. Let's try to parse it into an array if possible, 
      // or just split by newlines for better UI.

      const ideasList = response.split('\n').filter(line => line.trim().length > 0);
      setIdeas(ideasList);
    } catch (error) {
      console.error(error);
      alert('Brainstorming failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 text-amber-500 mb-2 ring-1 ring-amber-500/20">
            <Lightbulb size={24} />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Creative Spark</h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Generate innovative ideas, names, or strategies powered by Nexus AI lateral thinking.
          </p>
        </header>

        <div className="max-w-2xl mx-auto w-full space-y-6">
          <Card className="flex items-center gap-2 bg-background/80 border-white/10 p-2 pl-4">
            <Zap className="text-amber-500" size={20} />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()}
              placeholder="What do you need ideas for? (e.g., 'Marketing slogans for a coffee brand')"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-500 h-10"
            />
            <Button
              onClick={handleBrainstorm}
              isLoading={isGenerating}
              disabled={!topic.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
            >
              Generate <Sparkles className="ml-2 w-4 h-4" />
            </Button>
          </Card>

          {ideas.length > 0 && (
            <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {ideas.map((idea, index) => (
                <div
                  key={index}
                  className="group flex items-start justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex gap-3">
                    <span className="text-amber-500/50 font-mono text-sm mt-0.5">{(index + 1).toString().padStart(2, '0')}</span>
                    <p className="text-gray-200 leading-relaxed">{idea.replace(/^[\d\-\.\*]+\s*/, '')}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(idea)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-white transition-opacity"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ))}

              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBrainstorm}
                  leftIcon={<RefreshCw size={14} />}
                >
                  Regenerate Ideas
                </Button>
              </div>
            </div>
          )}

          {!ideas.length && !isGenerating && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-12 opacity-50">
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors" onClick={() => setTopic("Startup ideas for 2026")}>
                <p className="text-sm text-gray-300">"Startup ideas for 2026"</p>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors" onClick={() => setTopic("Blog post titles about AI")}>
                <p className="text-sm text-gray-300">"Blog titles about AI"</p>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors" onClick={() => setTopic("Youtube channel names for gaming")}>
                <p className="text-sm text-gray-300">"Gaming channel names"</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Brainstormer;
