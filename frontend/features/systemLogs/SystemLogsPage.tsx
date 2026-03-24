'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Shield, Bot, Package, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../../src/services/apiClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type LogType = 'auth' | 'api' | 'module' | 'ai';

type SystemLog = {
  id: string;
  type: LogType;
  action: string;
  module?: string | null;
  provider?: string | null;
  route?: string | null;
  timestamp?: string | null;
  timestampMillis?: number | null;
  clientTimestamp?: number | null;
  details?: {
    description?: string | null;
    status?: number | null;
    durationMs?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
};

function iconForType(type: LogType) {
  switch (type) {
    case 'auth':
      return <Shield size={16} className="text-emerald-400" />;
    case 'ai':
      return <Bot size={16} className="text-amber-400" />;
    case 'api':
      return <Package size={16} className="text-blue-400" />;
    case 'module':
    default:
      return <BarChart3 size={16} className="text-primary" />;
  }
}

function groupByDate(logs: SystemLog[]) {
  const groups: Record<string, SystemLog[]> = {};
  for (const l of logs) {
    const ms = (typeof l.timestampMillis === 'number' && l.timestampMillis) || (typeof l.clientTimestamp === 'number' && l.clientTimestamp) || (l.timestamp ? new Date(l.timestamp).getTime() : 0);
    const key = ms ? new Date(ms).toLocaleDateString() : 'Unknown date';
    groups[key] = groups[key] || [];
    groups[key].push(l);
  }
  return groups;
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LogType | 'all'>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (moduleFilter.trim()) params.set('module', moduleFilter.trim());

      const resp = await api.get<{ success: boolean; data: { logs: SystemLog[] } }>(`/system-logs?${params.toString()}`);
      const items = resp?.data?.logs || [];
      setLogs(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs().catch(() => undefined);
  }, [typeFilter, moduleFilter]);

  const grouped = useMemo(() => groupByDate(logs), [logs]);
  const dates = useMemo(() => Object.keys(grouped), [grouped]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-xl text-text-primary">System Logs</h1>
          <p className="text-text-secondary">User-specific audit trail for Nexus AI.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-9 px-3 rounded-lg bg-surface border border-border text-xs text-text-secondary"
          >
            <option value="all">All</option>
            <option value="auth">Auth</option>
            <option value="module">Module</option>
            <option value="api">API</option>
            <option value="ai">AI</option>
          </select>
          <input
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            placeholder="Filter module (e.g. settings)"
            className="h-9 px-3 rounded-lg bg-surface border border-border text-xs text-text-secondary"
          />
          <Button variant="secondary" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {dates.length === 0 && (
        <Card className="p-6">
          <div className="text-sm text-text-secondary">No logs yet.</div>
        </Card>
      )}

      <div className="space-y-6">
        {dates.map((date) => (
          <div key={date} className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-text-tertiary">{date}</div>
            <Card className="overflow-hidden">
              <div className="divide-y divide-white/5">
                {grouped[date].map((l) => (
                  <div key={l.id} className="p-4 flex items-start justify-between gap-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{iconForType(l.type)}</div>
                      <div>
                        <div className="text-sm text-gray-200 font-mono">{l.action}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {l.module ? <span className="mr-3">module: <span className="text-gray-300">{l.module}</span></span> : null}
                          {l.provider ? <span className="mr-3">provider: <span className="text-gray-300">{l.provider}</span></span> : null}
                          {l.route ? <span className="mr-3">route: <span className="text-gray-300">{l.route}</span></span> : null}
                          {typeof l.details?.status === 'number' ? <span className="mr-3">status: <span className="text-gray-300">{l.details.status}</span></span> : null}
                          {typeof l.details?.durationMs === 'number' ? <span>took: <span className="text-gray-300">{l.details.durationMs}ms</span></span> : null}
                        </div>
                        {(l.details?.description || l.details?.errorMessage) && (
                          <div className="text-xs text-gray-400 mt-1">
                            {l.details?.description ? <div>{l.details.description}</div> : null}
                            {l.details?.errorMessage ? <div>error: {l.details.errorMessage}</div> : null}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono whitespace-nowrap">
                      {(() => {
                        const ms = (typeof l.timestampMillis === 'number' && l.timestampMillis) || (typeof l.clientTimestamp === 'number' && l.clientTimestamp) || (l.timestamp ? new Date(l.timestamp).getTime() : 0);
                        return ms ? new Date(ms).toLocaleTimeString() : '--:--';
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
