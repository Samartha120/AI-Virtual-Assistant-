
import React, { useState, useEffect } from 'react';
import { KnowledgeItem } from '../../types';
import {
  fetchKnowledgeItems,
  createKnowledgeItem,
  deleteKnowledgeItem,
} from '../../services/firestoreService';

const KnowledgeBase: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '', type: 'research' as const });

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

  const handleAdd = async () => {
    if (!newItem.title || !newItem.content) return;
    try {
      const created = await createKnowledgeItem({
        title: newItem.title,
        content: newItem.content,
        type: newItem.type,
      });
      setItems((prev) => [created, ...prev]);
      setNewItem({ title: '', content: '', type: 'research' });
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to create knowledge item:', err);
      alert('Failed to save. Please try again.');
    }
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
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Knowledge Dataset</h2>
          <p className="text-gray-400">Your private library of reference material used to ground NexusAI's generations.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-600/20"
        >
          Add to Dataset
        </button>
      </header>

      {isAdding && (
        <div className="glass neon-border rounded-3xl p-8 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">New Entry</h3>
            <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Title (e.g., Marketing Q3 Strategy)"
              value={newItem.title}
              onChange={e => setNewItem({ ...newItem, title: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50"
            />
            <select
              value={newItem.type}
              onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
            >
              <option value="research">Research Paper</option>
              <option value="meeting">Meeting Notes</option>
              <option value="text">General Document</option>
            </select>
          </div>
          <textarea
            placeholder="Paste the content here..."
            value={newItem.content}
            onChange={e => setNewItem({ ...newItem, content: e.target.value })}
            className="w-full h-48 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 resize-none"
          />
          <div className="flex justify-end space-x-3">
            <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleAdd} className="px-8 py-2 bg-violet-600 rounded-xl text-white font-bold">Save Entry</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="glass neon-border p-6 rounded-3xl group relative">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => deleteItem(item.id)} className="text-gray-500 hover:text-red-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${item.type === 'research' ? 'bg-blue-400' : item.type === 'meeting' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{item.type}</span>
            </div>
            <h4 className="text-lg font-bold text-white mb-2 truncate pr-6">{item.title}</h4>
            <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed mb-4">{item.content}</p>
            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500">
              <span>{item.content.split(' ').length} words</span>
              <span>Added {item.dateAdded}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && !isAdding && (
          <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl opacity-50">
            <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <p className="text-gray-400 font-medium">Your knowledge dataset is empty.</p>
            <p className="text-xs text-gray-600 mt-1">Add reference material to help NexusAI understand your world.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
