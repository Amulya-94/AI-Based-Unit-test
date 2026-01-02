import { Project } from '../types';

const STORAGE_KEY = 'testgen_projects';

export const projectService = {
  healthCheck: async (): Promise<boolean> => {
    // Client-side is always "healthy"
    return true;
  },

  getAll: async (): Promise<Project[]> => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load projects", e);
      return [];
    }
  },

  create: async (project: Project): Promise<Project> => {
    const projects = await projectService.getAll();
    const updated = [project, ...projects];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return project;
  },

  update: async (project: Project): Promise<Project> => {
    const projects = await projectService.getAll();
    const updated = projects.map(p => p.id === project.id ? project : p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return project;
  },

  delete: async (id: string): Promise<void> => {
    const projects = await projectService.getAll();
    const updated = projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};