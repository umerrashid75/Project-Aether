"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

type EntitySelectionType = {
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  hoveredEntityId: string | null;
  setHoveredEntityId: (id: string | null) => void;
};

const EntitySelectionContext = createContext<EntitySelectionType | undefined>(undefined);

export function EntitySelectionProvider({ children }: { children: ReactNode }) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  return (
    <EntitySelectionContext.Provider 
      value={{ 
        selectedEntityId, 
        setSelectedEntityId, 
        hoveredEntityId, 
        setHoveredEntityId 
      }}
    >
      {children}
    </EntitySelectionContext.Provider>
  );
}

export function useEntitySelection() {
  const context = useContext(EntitySelectionContext);
  if (context === undefined) {
    throw new Error('useEntitySelection must be used within an EntitySelectionProvider');
  }
  return context;
}
