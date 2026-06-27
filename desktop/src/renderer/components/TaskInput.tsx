import { useState } from "react";

interface Props {
  onTaskCreated: () => void;
}

export default function TaskInput({ onTaskCreated }: Props) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await window.api.submitTask(title.trim());
      setTitle("");
      onTaskCreated();
    } catch (e) {
      console.error("Failed to submit task:", e);
    }
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">New Task</h2>
      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 10 }}>
        Describe what you want to build. The Planner agent will decompose it into issues with dependencies.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Build a REST API for user management with authentication"
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
        >
          {submitting ? "Decomposing..." : "Submit Task"}
        </button>
      </div>
    </div>
  );
}
