import { ExecutionResult } from '../types';

// Worker code as a string to avoid external file dependencies in this setup
const WORKER_CODE = `
self.onmessage = async (e) => {
    const { code, testCode } = e.data;
    const logs = [];
    const results = [];
    let currentTestLogs = null;

    // --- Polyfills for Jest-like environment ---

    const safeStringify = (arg) => {
        if (typeof arg === 'string') return arg;
        try {
            if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg, null, 2);
            return String(arg);
        } catch(e) { return '[Circular/Unserializable]'; }
    };

    const logToStore = (type, args) => {
        const message = args.map(safeStringify).join(' ');
        const entry = { type, message, timestamp: Date.now() };
        logs.push(entry);
        if (currentTestLogs) currentTestLogs.push(entry);
    };

    const console = {
        log: (...args) => logToStore('log', args),
        error: (...args) => logToStore('error', args),
        warn: (...args) => logToStore('warn', args),
        info: (...args) => logToStore('info', args),
    };

    const describe = (name, fn) => {
        logs.push({ type: 'group', message: name, timestamp: Date.now() });
        try { fn(); } 
        catch (err) { logs.push({ type: 'error', message: 'Error in describe: ' + err.message, timestamp: Date.now() }); }
        logs.push({ type: 'groupEnd', message: name, timestamp: Date.now() });
    };

    const it = (name, fn) => {
        const startTime = Date.now();
        currentTestLogs = [];
        try {
            fn();
            results.push({ name, status: 'pass', duration: Date.now() - startTime, logs: [...currentTestLogs] });
        } catch (err) {
            results.push({ name, status: 'fail', error: err.message, duration: Date.now() - startTime, logs: [...currentTestLogs] });
        }
        currentTestLogs = null;
    };

    const expect = (actual) => {
       logToStore('info', ['Actual Value:', actual]);
       return {
         toBe: (expected) => {
            if (Number.isNaN(actual) && Number.isNaN(expected)) return;
            if (actual !== expected) throw new Error(\`Expected \${safeStringify(expected)} but got \${safeStringify(actual)}\`);
         },
         toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) 
                throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
         },
         toBeDefined: () => { if (typeof actual === 'undefined') throw new Error('Expected defined'); },
         toBeUndefined: () => { if (typeof actual !== 'undefined') throw new Error(\`Expected undefined but got \${safeStringify(actual)}\`); },
         toBeNull: () => { if (actual !== null) throw new Error(\`Expected null but got \${safeStringify(actual)}\`); },
         toBeNaN: () => { if (!Number.isNaN(actual)) throw new Error(\`Expected NaN but got \${safeStringify(actual)}\`); },
         toBeTruthy: () => { if (!actual) throw new Error('Expected truthy'); },
         toBeFalsy: () => { if (actual) throw new Error('Expected falsy'); },
         toBeGreaterThan: (expected) => { if (!(actual > expected)) throw new Error(\`Expected \${actual} to be greater than \${expected}\`); },
         toBeLessThan: (expected) => { if (!(actual < expected)) throw new Error(\`Expected \${actual} to be less than \${expected}\`); },
         toBeInstanceOf: (expected) => { if (!(actual instanceof expected)) throw new Error(\`Expected instance of \${expected.name}\`); },
         toContain: (item) => { 
             if ((!Array.isArray(actual) && typeof actual !== 'string') || !actual.includes(item)) 
                throw new Error(\`Expected collection to contain \${safeStringify(item)}\`); 
         },
         toThrow: () => {
             let threw = false;
             try { actual(); } catch(e) { threw = true; }
             if (!threw) throw new Error('Expected function to throw');
         }
       };
    };

    // --- Execution ---
    try {
        // Clean imports/exports for browser execution
        const cleanSource = code
            .replace(/^\\s*import\\s+.*?\\s*$/gm, '')
            .replace(/^\\s*export\\s+(default\\s+)?/gm, '')
            .replace(/^\\s*export\\s+\\{.*?\\};?\\s*$/gm, '');
            
        const cleanTest = testCode
            .replace(/^\\s*import\\s+.*?\\s*$/gm, '')
            .replace(/^\\s*export\\s+(default\\s+)?/gm, '');

        // Wrap in Async Function to allow top-level await if needed, and isolation
        const run = new Function('console', 'describe', 'it', 'expect', \`
            \${cleanSource}
            ;
            \${cleanTest}
        \`);

        run(console, describe, it, expect);
        
        self.postMessage({ success: true, logs, results });
        
    } catch (err) {
        self.postMessage({ success: false, logs, results, error: err.message });
    }
};
`;

export const runTestsInSandbox = (code: string, testCode: string): Promise<ExecutionResult> => {
  return new Promise((resolve) => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    let timeoutId: any;

    worker.onmessage = (e) => {
      clearTimeout(timeoutId);
      resolve(e.data);
      worker.terminate();
    };

    worker.onerror = (e) => {
      clearTimeout(timeoutId);
      resolve({
        logs: [],
        results: [],
        success: false,
        error: `Runtime Error: ${e.message}`
      });
      worker.terminate();
    };

    worker.postMessage({ code, testCode });

    // 3 Second Timeout to prevent infinite loops
    timeoutId = setTimeout(() => {
        resolve({
            logs: [],
            results: [],
            success: false,
            error: "Execution Timed Out (3s limit)"
        });
        worker.terminate();
    }, 3000);
  });
};