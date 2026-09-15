"use client";

import { createContext, useContext, type ReactNode } from "react";

export type NodeViewContextValue = {
  onReplaceVideo?: (file: File) => void;
  onReplaceCaptions?: (file: File) => void;
  videoReplacementPending?: boolean;
  videoReplacementMessage?: string;
};

const NodeViewContext = createContext<NodeViewContextValue>({});

export function NodeViewContextProvider({
  value,
  children,
}: {
  value: NodeViewContextValue;
  children: ReactNode;
}) {
  return (
    <NodeViewContext.Provider value={value}>
      {children}
    </NodeViewContext.Provider>
  );
}

export function useNodeViewContext() {
  return useContext(NodeViewContext);
}
