"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api/client";

export function useInboxCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchCount() {
      try {
        const data = await api.get<{ unread: number }>("/api/inbox/count");
        if (active) setCount(data.unread ?? 0);
      } catch {
        // silently ignore network/auth errors
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}
