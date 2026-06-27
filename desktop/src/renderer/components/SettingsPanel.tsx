import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import type { AppSettings } from "../../shared/types";

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

export default function SettingsPanel({ settings, onSaved }: Props) {
  const { t } = useLang();
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.saveSettings(form);
      setMsg(t("settings.saved"));
      onSaved();
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const labelStyle = { fontSize: 12, color: "var(--text-secondary)", display: "block" as const, marginBottom: 4 };

  return (
    <div className="panel">
      <h2 className="panel-title">{t("settings.title")}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "500px" }}>
        <div>
          <label style={labelStyle}>{t("settings.apiUrl")}</label>
          <input className="input" value={form.apiUrl}
            onChange={e => setForm({ ...form, apiUrl: e.target.value })}
            placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label style={labelStyle}>{t("settings.apiKey")}</label>
          <input className="input" type="password" value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-..." />
        </div>
        <div>
          <label style={labelStyle}>{t("settings.model")}</label>
          <input className="input" value={form.model}
            onChange={e => setForm({ ...form, model: e.target.value })}
            placeholder="gpt-4o / claude-sonnet-4-6" />
        </div>
        <div>
          <label style={labelStyle}>{t("settings.maxAgents")}</label>
          <input className="input" type="number" min={1} max={20}
            value={form.maxAgents}
            onChange={e => setForm({ ...form, maxAgents: parseInt(e.target.value) || 6 })} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith("Error") ? "var(--accent-red)" : "var(--accent-green)" }}>{msg}</span>}
        </div>

        <div style={{ marginTop: 8, padding: 12, background: "var(--bg-input)", borderRadius: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong>{t("settings.supportedApis")}</strong>
          <ul style={{ marginTop: 4, paddingLeft: 16 }}>
            <li>OpenAI-compatible: https://api.openai.com/v1</li>
            <li>Anthropic: https://api.anthropic.com</li>
            <li>{t("settings.apiNote")} (vLLM, Ollama, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
