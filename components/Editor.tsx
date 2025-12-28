import React from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';

interface EditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  readOnly?: boolean;
  theme?: string;
  className?: string;
  onMount?: OnMount;
}

const Editor: React.FC<EditorProps> = ({ 
  value, 
  onChange, 
  language = 'javascript', 
  readOnly = false,
  className = "",
  onMount
}) => {
  return (
    <div className={`h-full w-full overflow-hidden rounded-md border border-neutral-700 bg-[#1e1e1e] ${className}`}>
      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        onMount={onMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          renderLineHighlight: "none", 
        }}
      />
    </div>
  );
};

export default Editor;