import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";

interface Props {
  onTaskCreated: () => void;
}

export default function TaskInput({ onTaskCreated }: Props) {
  const { t } = useLang();
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
      <h2 className="panel-title">{t("task.title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        {t("task.hint")}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("task.placeholder")}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
        >
          {submitting ? t("task.decomposing") : t("task.submit")}
        </button>
      </div>
    </div>
  );
}
