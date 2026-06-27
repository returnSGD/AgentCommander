import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Lang, getLang, setLang, t } from "./translations";

interface LanguageCtx {
  lang: Lang;
  t: (key: string) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageCtx>({
  lang: "zh-CN",
  t: (k) => k,
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);

  const translate = useCallback((key: string) => t(key, lang), [lang]);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "zh-CN" ? "en" : "zh-CN";
      setLang(next);
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t: translate, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
