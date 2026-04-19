"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';

type EntitySelectionType = {
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  hoveredEntityId: string | null;
  setHoveredEntityId: (id: string | null) => void;
};

const SelectedEntityIdContext = createContext<string | null | undefined>(undefined);
const HoveredEntityIdContext = createContext<string | null | undefined>(undefined);
const EntitySelectionActionsContext = createContext<{
  setSelectedEntityId: (id: string | null) => void;
  setHoveredEntityId: (id: string | null) => void;
} | undefined>(undefined);

export function EntitySelectionProvider({ children }: { children: ReactNode }) {
  const [selectedEntityId, setSelectedEntityIdState] = useState<string | null>(null);
  const [hoveredEntityId, setHoveredEntityIdState] = useState<string | null>(null);
  const hoverFrameRef = useRef<number | null>(null);

  const setSelectedEntityId = useCallback((id: string | null) => {
    setSelectedEntityIdState((prev) => (prev === id ? prev : id));
  }, []);

  const setHoveredEntityId = useCallback((id: string | null) => {
    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
    }

    hoverFrameRef.current = requestAnimationFrame(() => {
      setHoveredEntityIdState((prev) => (prev === id ? prev : id));
      hoverFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
      }
    };
  }, []);

  const actionsValue = useMemo(() => ({
    setSelectedEntityId,
    setHoveredEntityId,
  }), [setSelectedEntityId, setHoveredEntityId]);

  return (
    <EntitySelectionActionsContext.Provider value={actionsValue}>
      <SelectedEntityIdContext.Provider value={selectedEntityId}>
        <HoveredEntityIdContext.Provider value={hoveredEntityId}>
          {children}
        </HoveredEntityIdContext.Provider>
      </SelectedEntityIdContext.Provider>
    </EntitySelectionActionsContext.Provider>
  );
}

export function useEntitySelection() {
  const selectedEntityId = useSelectedEntityId();
  const hoveredEntityId = useHoveredEntityId();
  const actions = useEntitySelectionActions();

  return {
    selectedEntityId,
    hoveredEntityId,
    ...actions,
  } as EntitySelectionType;
}

export function useEntitySelectionActions() {
  const context = useContext(EntitySelectionActionsContext);
  if (context === undefined) {
    throw new Error('useEntitySelectionActions must be used within an EntitySelectionProvider');
  }
  return context;
}

export function useSelectedEntityId() {
  const context = useContext(SelectedEntityIdContext);
  if (context === undefined) {
    throw new Error('useSelectedEntityId must be used within an EntitySelectionProvider');
  }
  return context;
}

export function useHoveredEntityId() {
  const context = useContext(HoveredEntityIdContext);
  if (context === undefined) {
    throw new Error('useHoveredEntityId must be used within an EntitySelectionProvider');
  }
  return context;
}
