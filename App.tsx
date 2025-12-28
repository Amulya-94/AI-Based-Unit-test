import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, ExecutionResult } from './types';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import TestPanel from './components/TestPanel';
import { generateTests, generateTestFromPrompt } from './services/geminiService';
import { runTestsInSandbox } from './services/sandboxService';
import { Play, Sparkles, Split, Maximize2, Undo, Redo, X, CheckCircle, AlertCircle, Info, MessageSquarePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { OnMount } from '@monaco-editor/react';

const DEFAULT_CODE = `// Write a function to test
function calculateFactorial(n) {
  if (n < 0) return undefined;
  if (n === 0 || n === 1) return 1;
  return n * calculateFactorial(n - 1);
}
`;

const DEFAULT_TEST_CODE = `/* 
  Click "Generate Tests" to use AI 
  or write your own tests here using 
  describe(), it(), and expect().
*/
describe('Initial Test', () => {
    it('should be true', () => {
        expect(true).toBe(true);
    });
});
`;

// Simple Notification Component
const NotificationToast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
    const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

    return (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md ${bgColor} px-4 py-3 text-white shadow-lg transition-all animate-in slide-in-from-bottom-5`}>
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium">{message}</span>
            <button onClick={onClose} className="ml-2 rounded-full p-1 hover:bg-white/20">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('testgen_projects');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [layout, setLayout] = useState<'split' | 'code' | 'tests'>('split');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // New state for single test generation modal
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  const codeEditorRef = useRef<any>(null);
  const testEditorRef = useRef<any>(null);

  // Initialize with a default project if none exist
  useEffect(() => {
    if (projects.length === 0) {
      const newProject: Project = {
        id: uuidv4(),
        name: 'My First Project',
        code: DEFAULT_CODE,
        testCode: DEFAULT_TEST_CODE,
        language: 'javascript',
        createdAt: Date.now(),
      };
      setProjects([newProject]);
      setActiveProjectId(newProject.id);
    } else if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects.length, activeProjectId]);

  // Sync active project state
  useEffect(() => {
    if (activeProjectId) {
      const proj = projects.find(p => p.id === activeProjectId);
      if (proj) setActiveProject(proj);
    }
  }, [activeProjectId, projects]);

  // Auto-save to local storage
  useEffect(() => {
    localStorage.setItem('testgen_projects', JSON.stringify(projects));
  }, [projects]);

  // Auto-dismiss notification
  useEffect(() => {
      if (notification) {
          const timer = setTimeout(() => setNotification(null), 4000);
          return () => clearTimeout(timer);
      }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
  };

  const updateProject = (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p));
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: uuidv4(),
      name: `Project ${projects.length + 1}`,
      code: '// New function...\n',
      testCode: '',
      language: 'javascript',
      createdAt: Date.now(),
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setExecutionResult(null);
    showNotification("New project created", "success");
  };

  const handleDeleteProject = (id: string) => {
    const newProjects = projects.filter(p => p.id !== id);
    setProjects(newProjects);
    if (activeProjectId === id) {
      setActiveProjectId(newProjects.length > 0 ? newProjects[0].id : null);
      setActiveProject(newProjects.length > 0 ? newProjects[0] : null);
    }
    showNotification("Project deleted", "info");
  };

  const handleGenerateTests = async () => {
    if (!activeProject?.code) {
        showNotification("No source code to generate tests from!", "error");
        return;
    }
    
    setIsGenerating(true);
    try {
      const generatedTests = await generateTests(activeProject.code);
      updateProject({ testCode: generatedTests });
      showNotification("Tests generated successfully!", "success");
      
      // Automatically run tests after generation
      setTimeout(() => handleRunTests(), 500);
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "Failed to generate tests", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSingle = async () => {
    if (!activeProject?.code || !promptInput.trim()) return;

    setIsGeneratingSingle(true);
    try {
        const newTest = await generateTestFromPrompt(activeProject.code, promptInput);
        const updatedTests = (activeProject.testCode || '') + '\n\n' + newTest;
        updateProject({ testCode: updatedTests });
        showNotification("Test added successfully", "success");
        setPromptInput("");
        setIsPromptModalOpen(false);

        // Scroll to the bottom of the test editor to show the new test
        setTimeout(() => {
          if (testEditorRef.current) {
            const model = testEditorRef.current.getModel();
            if (model) {
              const lineCount = model.getLineCount();
              testEditorRef.current.revealLine(lineCount);
              testEditorRef.current.setPosition({ lineNumber: lineCount, column: 1 });
            }
          }
        }, 100);

    } catch (error: any) {
        console.error(error);
        showNotification(error.message || "Failed to generate test case", "error");
    } finally {
        setIsGeneratingSingle(false);
    }
  };

  const handleRunTests = useCallback(async () => {
    if (!activeProject) return;
    
    setIsRunning(true);
    setExecutionResult(null);
    try {
      // Small delay to allow UI to update
      await new Promise(r => setTimeout(r, 100));
      const result = await runTestsInSandbox(activeProject.code, activeProject.testCode);
      setExecutionResult(result);
      if (result.success) {
        // showNotification("Tests executed successfully", "success");
      } else {
        showNotification("Test execution error", "error");
      }
    } catch (err: any) {
       setExecutionResult({
           logs: [],
           results: [],
           success: false,
           error: err.message
       });
       showNotification("Sandbox error: " + err.message, "error");
    } finally {
      setIsRunning(false);
    }
  }, [activeProject]);

  const handleCodeEditorDidMount: OnMount = (editor) => {
    codeEditorRef.current = editor;
  };

  const handleTestEditorDidMount: OnMount = (editor) => {
    testEditorRef.current = editor;
  };

  const triggerUndo = (editorRef: React.MutableRefObject<any>) => {
    editorRef.current?.trigger('source', 'undo', null);
    editorRef.current?.focus();
  };

  const triggerRedo = (editorRef: React.MutableRefObject<any>) => {
    editorRef.current?.trigger('source', 'redo', null);
    editorRef.current?.focus();
  };

  if (!activeProject) return <div className="flex h-screen w-screen items-center justify-center bg-neutral-900 text-white">Loading...</div>;

  return (
    <div className="flex h-screen w-screen bg-neutral-900 text-white">
      {notification && (
          <NotificationToast 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
      )}

      {/* Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[500px] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold text-white mb-2">Generate Specific Test</h3>
                <p className="text-sm text-neutral-400 mb-4">Describe the test case you want to generate (e.g., "Check for null input handling").</p>
                
                <textarea 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    className="w-full h-32 rounded-md border border-neutral-700 bg-black/50 p-3 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none resize-none mb-4"
                    placeholder="Enter test description..."
                    autoFocus
                />
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setIsPromptModalOpen(false)}
                        className="px-4 py-2 rounded-md text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleGenerateSingle}
                        disabled={isGeneratingSingle || !promptInput.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isGeneratingSingle ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                Generate
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}

      <Sidebar 
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-neutral-700 bg-neutral-800 px-6">
          <div className="flex items-center gap-4">
             <input 
                type="text" 
                value={activeProject.name} 
                onChange={(e) => updateProject({ name: e.target.value })}
                className="bg-transparent text-lg font-semibold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2"
             />
          </div>

          <div className="flex items-center gap-3">
             <button
                onClick={() => setLayout(l => l === 'split' ? 'code' : 'split')}
                className="rounded-md p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                title="Toggle Layout"
             >
                 {layout === 'split' ? <Maximize2 className="h-5 w-5"/> : <Split className="h-5 w-5"/>}
             </button>
             
             <button
              onClick={handleGenerateTests}
              disabled={isGenerating}
              className={`flex items-center space-x-2 rounded-md px-4 py-2 font-medium transition-all ${
                  isGenerating 
                  ? 'bg-purple-900/50 text-purple-300 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
              }`}
             >
               {isGenerating ? (
                   <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Generating...</span>
                   </>
               ) : (
                   <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Tests</span>
                   </>
               )}
             </button>

             <button
              onClick={handleRunTests}
              disabled={isRunning}
              className={`flex items-center space-x-2 rounded-md px-4 py-2 font-medium transition-all ${
                  isRunning
                  ? 'bg-green-900/50 text-green-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20'
              }`}
             >
                <Play className="h-4 w-4 fill-current" />
                <span>Run Tests</span>
             </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
            {/* Editors Area */}
            <div className={`flex flex-col ${layout === 'split' ? 'w-2/3' : 'w-full'} border-r border-neutral-700 transition-all duration-300`}>
                {/* Code Section */}
                <div className={`${layout === 'split' ? 'h-1/2' : 'h-full'} flex flex-col border-b border-neutral-700`}>
                    <div className="flex items-center justify-between bg-[#1e1e1e] px-4 py-2 text-xs font-semibold uppercase text-neutral-500 tracking-wider">
                        <span>Source Code (JS/TS)</span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => triggerUndo(codeEditorRef)}
                                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                title="Undo (Ctrl+Z)"
                            >
                                <Undo className="h-3.5 w-3.5" />
                            </button>
                            <button 
                                onClick={() => triggerRedo(codeEditorRef)}
                                className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                title="Redo (Ctrl+Y)"
                            >
                                <Redo className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <Editor 
                            value={activeProject.code} 
                            onChange={(val) => updateProject({ code: val || '' })} 
                            language="javascript"
                            onMount={handleCodeEditorDidMount}
                        />
                    </div>
                </div>

                 {/* Test Code Section */}
                 {layout === 'split' && (
                    <div className="flex h-1/2 flex-col">
                        <div className="flex items-center justify-between bg-[#1e1e1e] px-4 py-2 text-xs font-semibold uppercase text-neutral-500 tracking-wider border-t border-neutral-700">
                            <span>Unit Tests</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsPromptModalOpen(true)}
                                    className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                    title="Generate specific test case"
                                >
                                    <MessageSquarePlus className="h-3.5 w-3.5" />
                                </button>
                                <div className="h-4 w-[1px] bg-neutral-700 mx-1"></div>
                                <button 
                                    onClick={() => triggerUndo(testEditorRef)}
                                    className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Undo className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                    onClick={() => triggerRedo(testEditorRef)}
                                    className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                                    title="Redo (Ctrl+Y)"
                                >
                                    <Redo className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <Editor 
                                value={activeProject.testCode} 
                                onChange={(val) => updateProject({ testCode: val || '' })} 
                                language="javascript"
                                onMount={handleTestEditorDidMount}
                            />
                        </div>
                    </div>
                 )}
            </div>

            {/* Results Panel */}
            <div className={`${layout === 'split' ? 'w-1/3' : 'w-0 hidden'} bg-neutral-900 transition-all duration-300`}>
                <TestPanel executionResult={executionResult} isRunning={isRunning} />
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;