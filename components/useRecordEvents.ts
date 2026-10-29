"use client";

import { useEffect, useRef } from "react";

export function useRecordEvents(onChange: () => void) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const source = new EventSource("/api/records/events");
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => onChangeRef.current(), 250);
    };

    source.addEventListener("records-changed", scheduleRefresh);

    return () => {
      if (debounce) clearTimeout(debounce);
      source.close();
    };
  }, []);
}