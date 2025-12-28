export interface Project {
  id: string;
  name: string;
  code: string;
  testCode: string;
  language: 'javascript' | 'typescript';
  createdAt: number;
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  error?: string;
  duration?: number;
  logs?: LogEntry[];
}

export interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'group' | 'groupEnd';
  message: string;
  timestamp: number;
}

export interface ExecutionResult {
  logs: LogEntry[];
  results: TestResult[];
  success: boolean;
  error?: string;
}

export type EditorTab = 'code' | 'tests';

export interface SandboxMessage {
  type: 'start';
  code: string;
  testCode: string;
}

export interface WorkerResponse {
  type: 'result' | 'error';
  data?: ExecutionResult;
  error?: string;
}