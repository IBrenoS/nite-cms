"use client";

import { createContext, useContext, type ReactNode } from "react";

type EditorMediaPreview = {
  mediaKind: "image" | "video" | "captions";
  src?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type EditorMediaMap = Record<string, EditorMediaPreview>;

export type NodeViewContextValue = {
  mediaById?: EditorMediaMap;
  onReplaceImage?: (file: File) => void;
  onReplaceVideo?: (file: File) => void;
  onReplaceCaptions?: (file: File) => void;
  mediaReplacementPending?: boolean;
  mediaReplacementMessage?: string;
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
