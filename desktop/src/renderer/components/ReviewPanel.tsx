import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import type { WorkflowProposal, WorkflowReview, AgentDefinition } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  proposals: WorkflowProposal[];
  reviews: WorkflowReview[];
  agents: AgentDefinition[];
  onRefresh: () => void;
}

export default function ReviewPanel({ proposals, reviews, agents, onRefresh }: Props) {
  const { t } = useLang();
  const [selectedProposal, setSelectedProposal] = useState<WorkflowProposal | null>(null);

  const getReviewsForProposal = (proposalId: string) =>
    reviews.filter(r => r.proposalId === proposalId);

  const getAgentName = (agentId: string) =>
    agents.find(a => a.id === agentId)?.name ?? agentId;

  const handleMerge = async (proposalId: string) => {
    await window.api.mergeProposal(proposalId);
    onRefresh();
  };

  const reviewerAgents = agents.filter(a => a.role === "reviewer" && a.status === "idle");

  const handleReview = async (proposal: WorkflowProposal, reviewerId: string, action: "approved" | "rejected") => {
    const proposalReviews = getReviewsForProposal(proposal.id);
    const myReview = proposalReviews.find(r => r.reviewerId === reviewerId);
    if (!myReview) return;

    const summary = action === "approved"
      ? "Approved: Solution looks correct and complete."
      : "Rejected: Solution needs revision.";

    await window.api.submitReview({ reviewId: myReview.id, status: action, summary, agentId: reviewerId });
    onRefresh();
  };

  const handleAIReview = async (proposal: WorkflowProposal, reviewerAgentId: string) => {
    await window.api.startAgent(reviewerAgentId, proposal.id);
    onRefresh();
  };

  const statusClass = (status: string) => {
    if (status === "merged") return "status-closed";
    if (status === "approved") return "status-resolved";
    if (status === "submitted" || status === "under_review") return "status-open";
    return "status-in_progress";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="panel">
        <h2 className="panel-title">
          {t("review.title")} ({proposals.length})
          <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
            {proposals.filter(p => p.status === "submitted" || p.status === "under_review").length} {t("review.pending")}
          </span>
        </h2>

        {proposals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
            {t("review.noProposals")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proposals.map(proposal => {
              const proposalReviews = getReviewsForProposal(proposal.id);
              const approvedCount = proposalReviews.filter(r => r.status === "approved").length;
              const rejectedCount = proposalReviews.filter(r => r.status === "rejected").length;

              return (
                <div
                  key={proposal.id}
                  className={`card ${selectedProposal?.id === proposal.id ? "selected" : ""}`}
                  onClick={() => setSelectedProposal(selectedProposal?.id === proposal.id ? null : proposal)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="card-title">{proposal.title}</div>
                      <div className="card-meta">
                        <span className={`status-tag ${statusClass(proposal.status)}`}>
                          {t(`status.${proposal.status}`)}
                        </span>
                        <span>{t("review.by")} {getAgentName(proposal.proposedBy)}</span>
                        <span>ID: {proposal.id}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {proposalReviews.length > 0 ? (
                          <span>
                            <span style={{ color: "var(--accent-green)" }}>{approvedCount} {t("review.approved")}</span>
                            {rejectedCount > 0 && <span style={{ color: "var(--accent-red)" }}>, {rejectedCount} {t("review.rejected")}</span>}
                            <span>, {proposalReviews.length - approvedCount - rejectedCount} {t("review.pendingCount")}</span>
                          </span>
                        ) : t("review.noReviewers")}
                      </div>

                      {proposal.status === "approved" && (
                        <button className="btn btn-primary btn-xs"
                          onClick={(e) => { e.stopPropagation(); handleMerge(proposal.id); }}>
                          {t("review.merge")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProposal && (
        <div className="panel">
          <h3 className="panel-title">{selectedProposal.title}</h3>
          <pre style={{
            whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text-primary)",
            background: "var(--bg-input)", padding: 16, borderRadius: 6,
            maxHeight: 300, overflowY: "auto", marginBottom: 12,
          }}>
            {selectedProposal.description}
          </pre>

          <h4 style={{ fontSize: 13, marginBottom: 8, color: "var(--text-secondary)" }}>
            {t("review.reviews")} ({getReviewsForProposal(selectedProposal.id).length})
          </h4>
          {getReviewsForProposal(selectedProposal.id).map(review => (
            <div key={review.id} style={{
              padding: "8px 12px", background: "var(--bg-input)", borderRadius: 4, marginBottom: 6, fontSize: 12,
              borderLeft: `3px solid ${review.status === "approved" ? "var(--accent-green)" : review.status === "rejected" ? "var(--accent-red)" : "var(--border-primary)"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: "var(--text-heading)" }}>{getAgentName(review.reviewerId)}</span>
                <span className={`status-tag ${review.status === "approved" ? "status-open" : "status-in_progress"}`}>
                  {t(`status.${review.status}`)}
                </span>
              </div>
              {review.summary && <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{review.summary}</div>}
            </div>
          ))}

          {selectedProposal.status === "submitted" && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("review.quickReview")}</span>
              {reviewerAgents.map(agent => (
                <button key={agent.id} className="btn btn-secondary btn-xs"
                  onClick={() => handleAIReview(selectedProposal!, agent.id)}
                  disabled={agent.status === "working"}>
                  {agent.name}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{t("review.manualHint")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
