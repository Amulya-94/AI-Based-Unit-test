import React from 'react';
import { ExecutionResult, TestResult, LogEntry } from '../types';
import { CheckCircle, XCircle, AlertCircle, Clock, Terminal } from 'lucide-react';

interface TestPanelProps {
  executionResult: ExecutionResult | null;
  isRunning: boolean;
}

const TestPanel: React.FC<TestPanelProps> = ({ executionResult, isRunning }) => {
  const [activeTab, setActiveTab] = React.useState<'results' | 'logs'>('results');

  if (isRunning) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 text-neutral-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p>Running tests in sandbox...</p>
      </div>
    );
  }

  if (!executionResult) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-neutral-500">
        <Terminal className="mb-4 h-12 w-12 opacity-50" />
        <p className="text-lg">Ready to execute</p>
        <p className="text-sm">Click "Run Tests" to execute your code.</p>
      </div>
    );
  }

  const { results, logs, success, error } = executionResult;
  const passedCount = results.filter(r => r.status === 'pass').length;
  const failedCount = results.filter(r => r.status === 'fail').length;

  return (
    <div className="flex h-full flex-col text-sm text-neutral-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-4 py-2">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center space-x-2 border-b-2 px-2 py-1 transition-colors ${
              activeTab === 'results' ? 'border-blue-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Results ({passedCount}/{results.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 border-b-2 px-2 py-1 transition-colors ${
              activeTab === 'logs' ? 'border-blue-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Output ({logs.length})</span>
          </button>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          {success && !error && <span className="text-green-400">Success</span>}
          {error && <span className="text-red-400">Error</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4">
        {error && (
            <div className="mb-4 rounded-md border border-red-900/50 bg-red-900/20 p-4 text-red-200">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
                </div>
            </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-3">
            {results.length === 0 && !error && (
                <div className="text-center text-neutral-500 py-10">
                    No tests found. Did you define any `it` blocks?
                </div>
            )}
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`flex flex-col rounded-md border p-3 transition-colors ${
                  result.status === 'pass'
                    ? 'border-green-900/30 bg-green-900/10 hover:bg-green-900/20'
                    : 'border-red-900/30 bg-red-900/10 hover:bg-red-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {result.status === 'pass' ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    )}
                    <div>
                      <span className="font-medium text-neutral-200 block leading-tight mb-1">{result.name}</span>
                      
                      {/* Inline Logs/Output */}
                      {result.logs && result.logs.length > 0 && (
                        <div className="mt-2 text-xs">
                             <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Log Output</div>
                             <div className="rounded bg-black/50 p-2 font-mono text-neutral-400">
                                {result.logs.map((log, i) => (
                                    <div key={i} className={`whitespace-pre-wrap ${
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'warn' ? 'text-yellow-400' :
                                        log.type === 'info' ? 'text-cyan-400/80 italic' : ''
                                    }`}>
                                        {log.message}
                                    </div>
                                ))}
                             </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {result.error && (
                        <div className="mt-2 rounded bg-red-950/50 border border-red-900/50 p-2 font-mono text-xs text-red-300 whitespace-pre-wrap">
                            {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-neutral-500 flex-shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{result.duration ?? 0}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="font-mono text-xs">
            {logs.length === 0 && <div className="text-neutral-500 italic">No global logs captured.</div>}
            {logs.map((log, idx) => (
              <div key={idx} className="mb-1 flex space-x-2 border-b border-neutral-800/50 pb-1 last:border-0">
                <span className="text-neutral-500">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>
                <span
                  className={`${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warn'
                      ? 'text-yellow-400'
                      : log.type === 'group'
                      ? 'text-blue-400 font-bold'
                      : log.type === 'info'
                      ? 'text-cyan-400'
                      : 'text-neutral-300'
                  }`}
                >
                  {log.type === 'group' ? '> ' : ''}{log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPanel;