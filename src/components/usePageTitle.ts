"use client";

import { useEffect } from "react";

/** Keeps the browser tab named after the section: "Weekly Report · KPIvantra". */
export function usePageTitle(section?: string) {
  useEffect(() => {
    document.title = section ? `${section} · KPIvantra` : "KPIvantra";
  }, [section]);
}
