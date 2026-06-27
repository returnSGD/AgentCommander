import { useState, useCallback, useEffect, useRef } from "react";
import { useLang } from "../i18n/LanguageContext";

interface TutorialStep {
  target: string;
  titleKey: string;
  descKey: string;
  placement?: "bottom" | "top" | "right" | "left";
}

const STEPS: TutorialStep[] = [
  { target: "", titleKey: "tutorial.welcome.title", descKey: "tutorial.welcome.desc" },
  { target: ".sidebar-btn:nth-child(4)", titleKey: "tutorial.step1.title", descKey: "tutorial.step1.desc", placement: "right" },
  { target: ".tab-content", titleKey: "tutorial.step2.title", descKey: "tutorial.step2.desc", placement: "bottom" },
  { target: ".kanban", titleKey: "tutorial.step3.title", descKey: "tutorial.step3.desc", placement: "top" },
  { target: ".sidebar-btn:nth-child(3)", titleKey: "tutorial.step4.title", descKey: "tutorial.step4.desc", placement: "right" },
  { target: ".sidebar-btn:nth-child(2)", titleKey: "tutorial.step5.title", descKey: "tutorial.step5.desc", placement: "right" },
  { target: "", titleKey: "tutorial.step6.title", descKey: "tutorial.step6.desc" },
];

const STORAGE_KEY = "agentcommander_tutorial_done";

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorialDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch { /* noop */ }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  onDone: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export default function Tutorial({ onDone, onStepChange }: Props) {
  const { t } = useLang();
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number>(0);

  const step = STEPS[stepIdx];

  useEffect(() => {
    onStepChange?.(stepIdx);
  }, [stepIdx, onStepChange]);

  const updateRect = useCallback(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  useEffect(() => {
    updateRect();
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    };
    window.addEventListener("resize", onResize);
    const timer = setTimeout(updateRect, 100);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
  }, [updateRect]);

  useEffect(() => {
    if (!targetRect) {
      setTooltipStyle({ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      return;
    }
    const placement = step.placement || "bottom";
    const gap = 16;
    const maxW = 360;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let style: React.CSSProperties = { position: "fixed", maxWidth: maxW };
    if (placement === "bottom") {
      style.top = targetRect.top + targetRect.height + gap;
      style.left = Math.min(targetRect.left + targetRect.width / 2, vw - maxW - 20);
    } else if (placement === "top") {
      style.bottom = vh - targetRect.top + gap;
      style.left = Math.min(targetRect.left + targetRect.width / 2, vw - maxW - 20);
    } else if (placement === "right") {
      style.left = targetRect.left + targetRect.width + gap;
      style.top = Math.min(targetRect.top + targetRect.height / 2, vh - 200);
    } else {
      style.right = vw - targetRect.left + gap;
      style.top = Math.min(targetRect.top + targetRect.height / 2, vh - 200);
    }
    setTooltipStyle(style);
  }, [targetRect, step.placement]);

  const handleNext = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      markTutorialDone();
      onDone();
    }
  };

  const handleSkip = () => { markTutorialDone(); onDone(); };

  const isLast = stepIdx === STEPS.length - 1;

  const overlayBg = "var(--overlay)";

  return (
    <>
      {targetRect ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: targetRect.top, background: overlayBg }} />
          <div style={{ position: "fixed", top: targetRect.top + targetRect.height, left: 0, right: 0, bottom: 0, background: overlayBg }} />
          <div style={{ position: "fixed", top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height, background: overlayBg }} />
          <div style={{ position: "fixed", top: targetRect.top, left: targetRect.left + targetRect.width, width: `calc(100vw - ${targetRect.left + targetRect.width}px)`, height: targetRect.height, background: overlayBg }} />
          <div style={{
            position: "fixed", top: targetRect.top - 4, left: targetRect.left - 4,
            width: targetRect.width + 8, height: targetRect.height + 8,
            borderRadius: 8, border: "2px solid var(--accent-blue)", boxShadow: "0 0 20px rgba(88,166,255,0.3)",
          }} />
        </div>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay-light)", zIndex: 9998 }} />
      )}

      <div style={{
        ...tooltipStyle, zIndex: 9999,
        background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
        borderRadius: 12, padding: "24px 24px 20px",
        boxShadow: "0 16px 48px var(--shadow-heavy)",
        minWidth: targetRect ? 320 : 420, maxWidth: targetRect ? 380 : 480,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-heading)", marginBottom: 10 }}>
          {t(step.titleKey)}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-wrap" }}>
          {t(step.descKey)}
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, justifyContent: "center" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === stepIdx ? 20 : 8, height: 8, borderRadius: 4,
              background: i === stepIdx ? "var(--accent-blue)" : "var(--border-primary)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={handleSkip} style={{
            background: "transparent", border: "none", color: "var(--text-muted)",
            cursor: "pointer", fontSize: 12, padding: 4,
          }}>
            {t("tutorial.skip")}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {stepIdx > 0 && (
              <button className="btn btn-secondary" onClick={() => setStepIdx(stepIdx - 1)} style={{ fontSize: 12 }}>
                {t("tutorial.back")}
              </button>
            )}
            <button className="btn btn-primary" onClick={handleNext} style={{ fontSize: 12 }}>
              {isLast ? t("tutorial.done") : t("tutorial.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
