import React from 'react';
import { Project } from '../types';
import { Plus, Folder, Trash2, Code2 } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}) => {
  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-700 bg-neutral-900">
      <div className="border-b border-neutral-700 p-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Code2 className="text-blue-500 w-6 h-6" />
                <h1 className="text-lg font-bold text-white tracking-tight">TestGen<span className="text-blue-500">.ai</span></h1>
            </div>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={onCreateProject}
          className="flex w-full items-center justify-center space-x-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">Your Projects</div>
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${
                activeProjectId === project.id
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                <Folder className={`h-4 w-4 flex-shrink-0 ${activeProjectId === project.id ? 'text-blue-500' : 'text-neutral-600'}`} />
                <span className="truncate">{project.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(project.id);
                }}
                className="hidden text-neutral-500 hover:text-red-400 group-hover:block"
                title="Delete Project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
              <div className="text-center py-10 px-4 text-xs text-neutral-600">
                  No projects yet. Create one to get started!
              </div>
          )}
        </div>
      </div>

      <div className="border-t border-neutral-800 p-4 text-xs text-neutral-600">
        <p>Powered by Gemini 3 Flash</p>
        <p className="mt-1">v1.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;