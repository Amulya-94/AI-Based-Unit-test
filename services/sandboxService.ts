import { ExecutionResult, WorkerResponse } from '../types';

const workerScript = `
self.onmessage = function(e) {
  const { code, testCode } = e.data;
  
  const logs = [];
  const results = [];
  let currentTestLogs = null;

  const safeStringify = (arg) => {
    if (typeof arg === 'string') return arg;
    try {
        if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    } catch(e) {
        return '[Circular/Unserializable]';
    }
  };

  const logToStore = (type, args) => {
    const message = args.map(safeStringify).join(' ');
    const entry = { type, message, timestamp: Date.now() };
    logs.push(entry);
    if (currentTestLogs) {
        currentTestLogs.push(entry);
    }
  };
  
  // Polyfill console
  const mockConsole = {
    log: (...args) => logToStore('log', args),
    error: (...args) => logToStore('error', args),
    warn: (...args) => logToStore('warn', args),
    info: (...args) => logToStore('info', args),
  };

  // Polyfill describe/it/expect
  const describe = (name, fn) => {
    logs.push({ type: 'group', message: name, timestamp: Date.now() });
    try {
      fn();
    } catch (err) {
      logs.push({ type: 'error', message: 'Error in describe block: ' + err.message, timestamp: Date.now() });
    }
    logs.push({ type: 'groupEnd', message: name, timestamp: Date.now() });
  };

  const it = (name, fn) => {
    const startTime = Date.now();
    currentTestLogs = []; // Start capturing logs for this specific test
    
    try {
      fn();
      results.push({ 
        name, 
        status: 'pass', 
        duration: Date.now() - startTime,
        logs: [...currentTestLogs]
      });
    } catch (err) {
      results.push({ 
        name, 
        status: 'fail', 
        error: err.message, 
        duration: Date.now() - startTime,
        logs: [...currentTestLogs]
      });
    }
    
    currentTestLogs = null; // Stop capturing
  };

  const expect = (actual) => {
    // Automatically log the actual value being asserted for visibility
    // This helps users see return values (like sums) without manually adding console.logs
    logToStore('info', ['Actual Value:', actual]);

    return {
      toBe: (expected) => {
        // Handle NaN comparison (NaN === NaN is false in JS, but true in tests)
        if (Number.isNaN(actual) && Number.isNaN(expected)) return;
        if (actual !== expected) throw new Error(\`Expected \${safeStringify(expected)} but got \${safeStringify(actual)}\`);
      },
      toEqual: (expected) => {
        const stringify = (obj) => {
          try {
              if (obj === undefined) return 'undefined';
              if (Number.isNaN(obj)) return 'NaN';
              return JSON.stringify(obj);
          } catch(e) {
              return String(obj);
          }
        }
        if (stringify(actual) !== stringify(expected)) {
          throw new Error(\`Expected \${stringify(expected)} but got \${stringify(actual)}\`);
        }
      },
      toBeDefined: () => {
        if (typeof actual === 'undefined') throw new Error('Expected value to be defined');
      },
      toBeNull: () => {
        if (actual !== null) throw new Error(\`Expected null but got \${safeStringify(actual)}\`);
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(\`Expected value to be truthy\`);
      },
      toBeFalsy: () => {
        if (actual) throw new Error(\`Expected value to be falsy\`);
      },
      toContain: (item) => {
        if (Array.isArray(actual) || typeof actual === 'string') {
            if (!actual.includes(item)) {
              throw new Error(\`Expected collection to contain \${safeStringify(item)}\`);
            }
        } else {
          throw new Error('Expect.toContain must be used with an array or string');
        }
      },
      toThrow: (expectedError) => {
         let threw = false;
         let error;
         try {
           actual();
         } catch (e) {
           threw = true;
           error = e;
         }
         if (!threw) throw new Error('Expected function to throw an error');
      }
    };
  };

  try {
    // Override console
    self.console = mockConsole;

    // Expose testing utilities to global scope
    self.describe = describe;
    self.it = it;
    self.expect = expect;

    // Execute User Code
    // Pre-process code to remove module syntax that breaks eval in non-module workers
    const safeCode = code
        .replace(/^\\s*import\\s+.*?\\s*$/gm, '') // Remove import statements
        .replace(/^\\s*export\\s+(default\\s+)?/gm, '') // Remove export keywords (keep the rest of the line)
        .replace(/^\\s*export\\s+\\{.*?\\};?\\s*$/gm, ''); // Remove named export blocks like "export { foo };"

    // We use (0, eval) to execute in the global scope. 
    // This ensures function declarations like 'function foo(){}' are attached to 'self' 
    // and visible to the subsequent test code execution.
    try {
        (0, eval)(safeCode);
    } catch (err) {
        throw new Error("Error in Source Code: " + err.message);
    }

    // Execute Test Code
    // Pre-process test code similarly
    const safeTestCode = testCode
        .replace(/^\\s*import\\s+.*?\\s*$/gm, '')
        .replace(/^\\s*export\\s+(default\\s+)?/gm, '');

    try {
        (0, eval)(safeTestCode);
    } catch (err) {
        throw new Error("Error in Test Code: " + err.message);
    }

    self.postMessage({ 
      type: 'result', 
      data: { logs, results, success: true } 
    });

  } catch (err) {
    self.postMessage({ 
      type: 'error', 
      error: err.message 
    });
  }
};
`;

export const runTestsInSandbox = (code: string, testCode: string): Promise<ExecutionResult> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    // Timeout to prevent infinite loops
    const timeoutId = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error("Execution timed out (infinite loop?)"));
    }, 5000);

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);

      if (e.data.type === 'error') {
        resolve({
          logs: [],
          results: [],
          success: false,
          error: e.data.error
        });
      } else {
        resolve(e.data.data!);
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.postMessage({ code, testCode });
  });
};