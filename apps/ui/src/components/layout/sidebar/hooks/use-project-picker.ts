import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Project } from '@/lib/electron';

interface UseProjectPickerProps {
  projects: Project[];
  currentProject: Project | null;
  isProjectPickerOpen: boolean;
  setIsProjectPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setCurrentProject: (project: Project) => void;
}

export function useProjectPicker({
  projects,
  currentProject,
  isProjectPickerOpen,
  setIsProjectPickerOpen,
  setCurrentProject,
}: UseProjectPickerProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  // Filtered projects based on search query
  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) {
      return projects;
    }
    const query = projectSearchQuery.toLowerCase();
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, projectSearchQuery]);

  // Reset selection when filtered results change and project picker is open
  useEffect(() => {
    if (!isProjectPickerOpen) {
      return;
    }

    if (!projectSearchQuery.trim()) {
      const currentIndex = currentProject
        ? filteredProjects.findIndex((p) => p.id === currentProject.id)
        : -1;
      if (currentIndex !== -1) {
        setSelectedProjectIndex(currentIndex);
        return;
      }
    }

    setSelectedProjectIndex(0);
  }, [isProjectPickerOpen, filteredProjects.length, projectSearchQuery, currentProject]);

  // Reset search query when dropdown closes, set to current project index when it opens
  useEffect(() => {
    if (!isProjectPickerOpen) {
      setProjectSearchQuery('');
      setSelectedProjectIndex(0);
    } else {
      // Focus the search input when dropdown opens
      // Small delay to ensure the dropdown is rendered
      setTimeout(() => {
        projectSearchInputRef.current?.focus();
      }, 0);
    }
  }, [isProjectPickerOpen]);

  // Handle selecting the currently highlighted project
  const selectHighlightedProject = useCallback(() => {
    if (filteredProjects.length > 0 && selectedProjectIndex < filteredProjects.length) {
      setCurrentProject(filteredProjects[selectedProjectIndex]);
      setIsProjectPickerOpen(false);
    }
  }, [filteredProjects, selectedProjectIndex, setCurrentProject, setIsProjectPickerOpen]);

  // Handle keyboard events when project picker is open
  useEffect(() => {
    if (!isProjectPickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectPickerOpen(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        selectHighlightedProject();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedProjectIndex((prev) => (prev < filteredProjects.length - 1 ? prev + 1 : prev));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedProjectIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (event.key.toLowerCase() === 'p' && !event.metaKey && !event.ctrlKey) {
        // Toggle off when P is pressed (not with modifiers) while dropdown is open
        // Only if not typing in the search input
        if (document.activeElement !== projectSearchInputRef.current) {
          event.preventDefault();
          setIsProjectPickerOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isProjectPickerOpen,
    selectHighlightedProject,
    filteredProjects.length,
    setIsProjectPickerOpen,
  ]);

  return {
    projectSearchQuery,
    setProjectSearchQuery,
    selectedProjectIndex,
    setSelectedProjectIndex,
    projectSearchInputRef,
    filteredProjects,
    selectHighlightedProject,
  };
}
