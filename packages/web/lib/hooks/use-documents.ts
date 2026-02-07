"use client";

import { useState, useEffect, useCallback } from "react";
import { api, buildQuery } from "@/lib/api/client";

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Doc = Record<string, unknown>;

export function useDocuments(projectId: string, parentDocumentId?: string) {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Doc>>(
        `/api/projects/${projectId}/documents${buildQuery({ parentDocumentId, limit: 100 })}`,
      );
      setDocuments(data.items);
      setTotal(data.total);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [projectId, parentDocumentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { documents, total, loading, refresh };
}

export function useDocumentTree(projectId: string) {
  const [tree, setTree] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Doc[]>(`/api/projects/${projectId}/documents/tree`);
      setTree(data);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tree, loading, refresh };
}

export function useCreateDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDocument = useCallback(
    async (
      projectId: string,
      body: {
        title: string;
        contentType?: string;
        bodyMd?: string;
        parentDocumentId?: string;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<Doc>(`/api/projects/${projectId}/documents`, body);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { createDocument, loading, error };
}

export function useUpdateDocument() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDocument = useCallback(
    async (
      projectId: string,
      documentId: string,
      body: { title?: string; bodyMd?: string },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.patch<Doc>(
          `/api/projects/${projectId}/documents/${documentId}`,
          body,
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { updateDocument, loading, error };
}

export function useDeleteDocument() {
  const [loading, setLoading] = useState(false);

  const deleteDocument = useCallback(async (projectId: string, documentId: string) => {
    setLoading(true);
    try {
      await api.delete(`/api/projects/${projectId}/documents/${documentId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteDocument, loading };
}
