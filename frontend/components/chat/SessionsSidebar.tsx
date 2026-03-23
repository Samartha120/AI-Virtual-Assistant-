import React, { useEffect, useState } from 'react';
import { getAiSessions } from '../../services/aiService';

interface SessionsSidebarProps {
  moduleName: string;
  currentSessionId: string | undefined;
  onSelectSession: (id: string | undefined) => void;
}

export const SessionsSidebar: React.FC<SessionsSidebarProps> = ({ moduleName, currentSessionId, onSelectSession }) => {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    getAiSessions(moduleName).then(setSessions).catch(console.error);
  }, [moduleName, currentSessionId]); // Re-fetch occasionally or when currentSessionId changes (new session)

  return (
    <div className="w-1/4 min-w-[250px] max-w-[320px] border-r border-border-default hidden md:flex flex-col bg-surface-primary shrink-0 h-full overflow-hidden">
      <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-primary">
        <h3 className="text-sm font-semibold text-text-primary">Recent Sessions</h3>
        <button 
          onClick={() => onSelectSession(undefined)}
          className="text-primary hover:text-primary-focus text-xs font-medium px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {sessions.length === 0 ? (
          <p className="text-xs text-text-muted text-center mt-4">No recent sessions</p>
        ) : (
          sessions.map(sess => (
            <button
              key={sess.id}
              onClick={() => onSelectSession(sess.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                currentSessionId === sess.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              {sess.title || 'Untitled Session'}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
