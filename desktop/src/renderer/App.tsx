import { useState, useEffect, useCallback } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TaskInput from "./components/TaskInput";
import IssueBoard from "./components/IssueBoard";
import AgentPool from "./components/AgentPool";
import ReviewPanel from "./components/ReviewPanel";
import type { AppState, AgentDefinition, WorkflowIssue, WorkflowProposal, WorkflowReview } from "../shared/types";
import "./App.css";

type Tab = "issues" | "reviews" | "agents" | "settings";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("issues");
  const [loading, setLoading] = useState(true);

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
        <p>Starting AgentCommander...</p>
      </div>
    );
  }

  if (!state) {
    return <div className="loading-screen"><p>Failed to load. Please restart.</p></div>;
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "issues", label: "Issue Board", badge: state.issues.filter(i => i.status === "open").length },
    { key: "reviews", label: "Reviews", badge: state.proposals.filter(p => p.status === "submitted" || p.status === "under_review").length },
    { key: "agents", label: "Agent Pool", badge: state.agents.filter(a => a.status === "working").length },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">
          <span className="title-icon">&#9654;</span> AgentCommander
        </h1>
        <div className="header-status">
          <span className={`status-dot ${state.settings.apiKey ? "connected" : "disconnected"}`} />
          {state.settings.apiKey ? `Connected (${state.settings.model})` : "API not configured"}
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
    </div>
  );
}
