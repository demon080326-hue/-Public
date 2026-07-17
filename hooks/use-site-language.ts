"use client";

import { useEffect, useState } from "react";
import { SiteLanguage } from "@/lib/site-language";

export const siteLanguageEvent = "james-site-language-change";

export function useSiteLanguage() {
  const [language, setLanguage] = useState<SiteLanguage>("zh-Hant");

  useEffect(() => {
    const stored = localStorage.getItem("james-site-language") as SiteLanguage | null;
    const loadLanguage = window.setTimeout(() => {
      if (stored === "zh-Hant" || stored === "en" || stored === "ja") setLanguage(stored);
    }, 0);

    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<SiteLanguage>).detail;
      if (nextLanguage === "zh-Hant" || nextLanguage === "en" || nextLanguage === "ja") setLanguage(nextLanguage);
    };

    window.addEventListener(siteLanguageEvent, handleLanguageChange);
    return () => {
      window.clearTimeout(loadLanguage);
      window.removeEventListener(siteLanguageEvent, handleLanguageChange);
    };
  }, []);

  return language;
}
