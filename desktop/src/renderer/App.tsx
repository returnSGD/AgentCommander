import { useState, useEffect, useCallback } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TaskInput from "./components/TaskInput";
import IssueBoard from "./components/IssueBoard";
import AgentPool from "./components/AgentPool";
import ReviewPanel from "./components/ReviewPanel";
import Tutorial, { isTutorialDone } from "./components/Tutorial";
import { LanguageProvider, useLang } from "./i18n/LanguageContext";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import type { AppState, AgentDefinition, WorkflowIssue, WorkflowProposal, WorkflowReview } from "../shared/types";
import "./App.css";

type Tab = "issues" | "reviews" | "agents" | "settings";

function AppShell() {
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [state, setState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("issues");
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(!isTutorialDone());

  const handleTutorialStep = useCallback((stepIdx: number) => {
    const tabMap: Record<number, Tab> = {
      0: "issues", 1: "settings", 2: "issues",
      3: "issues", 4: "agents", 5: "reviews", 6: "issues",
    };
    const targetTab = tabMap[stepIdx];
    if (targetTab) setActiveTab(targetTab);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const s = await window.api.getState();
      setState(s);
    } catch (e) {
      console.error("Failed to load state:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
    window.api.onStateChanged(() => refreshState());
    return () => { window.api.removeAllListeners("app:state-changed"); };
  }, [refreshState]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>{t("app.loading")}</p>
      </div>
    );
  }

  if (!state) {
    return <div className="loading-screen"><p>{t("app.loadError")}</p></div>;
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "issues", label: t("tab.issues"), badge: state.issues.filter(i => i.status === "open").length },
    { key: "reviews", label: t("tab.reviews"), badge: state.proposals.filter(p => p.status === "submitted" || p.status === "under_review").length },
    { key: "agents", label: t("tab.agents"), badge: state.agents.filter(a => a.status === "working").length },
    { key: "settings", label: t("tab.settings") },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">
          <span className="title-icon">&#9654;</span> {t("app.title")}
        </h1>
        <div className="header-status">
          <span className={`status-dot ${state.settings.apiKey ? "connected" : "disconnected"}`} />
          {state.settings.apiKey
            ? `${t("app.connected")} (${state.settings.model})`
            : t("app.disconnected")}

          <button className="header-btn-text" onClick={toggleLang} title={t("lang.switch")}>
            {lang === "zh-CN" ? "EN" : "中"}
          </button>

          <button className="header-btn-text" onClick={toggleTheme}
            title={theme === "dark" ? t("theme.switchLight") : t("theme.switchDark")}>
            {theme === "dark" ? "☀" : "☾"}
          </button>

          <button className="header-btn" onClick={() => setShowTutorial(true)} title={t("app.helpTip")}>
            ?
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`sidebar-btn ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.badge ? <span className="badge">{tab.badge}</span> : null}
            </button>
          ))}
        </nav>

        <main className="main-content">
          {activeTab === "issues" && (
            <div className="tab-content">
              <TaskInput onTaskCreated={refreshState} />
              <IssueBoard
                issues={state.issues}
                agents={state.agents}
                onRefresh={refreshState}
              />
            </div>
          )}
          {activeTab === "reviews" && (
            <div className="tab-content">
              <ReviewPanel
                proposals={state.proposals}
                reviews={state.reviews}
                agents={state.agents}
                onRefresh={refreshState}
              />
            </div>
          )}
          {activeTab === "agents" && (
            <div className="tab-content">
              <AgentPool
                agents={state.agents}
                issues={state.issues}
                proposals={state.proposals}
                onRefresh={refreshState}
              />
            </div>
          )}
          {activeTab === "settings" && (
            <div className="tab-content">
              <SettingsPanel settings={state.settings} onSaved={refreshState} />
            </div>
          )}
        </main>
      </div>

      {showTutorial && (
        <Tutorial
          onDone={() => setShowTutorial(false)}
          onStepChange={handleTutorialStep}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </ThemeProvider>
  );
}
