"use client";

import { useState, useEffect } from "react";

export function useInboxCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchCount() {
      try {
        const res = await fetch("/api/inbox/count");
        if (res.ok) {
          const data = await res.json();
          if (active) setCount(data.unread ?? data.count ?? 0);
        }
      } catch {
        // silently ignore network errors
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
