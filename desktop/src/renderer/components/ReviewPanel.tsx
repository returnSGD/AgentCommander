import { useState } from "react";
import type { WorkflowProposal, WorkflowReview, AgentDefinition } from "../../shared/types";
import AgentTerminal from "./AgentTerminal";

interface Props {
  proposals: WorkflowProposal[];
  reviews: WorkflowReview[];
  agents: AgentDefinition[];
  onRefresh: () => void;
}

export default function ReviewPanel({ proposals, reviews, agents, onRefresh }: Props) {
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

    await window.api.submitReview({
      reviewId: myReview.id,
      status: action,
      summary,
      agentId: reviewerId,
    });
    onRefresh();
  };

  const handleAIReview = async (proposal: WorkflowProposal, reviewerAgentId: string) => {
    await window.api.startAgent(reviewerAgentId, proposal.id);
    onRefresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="panel">
        <h2 className="panel-title">
          Proposals ({proposals.length})
          <span style={{ fontSize: 12, color: "#8b949e", marginLeft: 8 }}>
            {proposals.filter(p => p.status === "submitted" || p.status === "under_review").length} pending review
          </span>
        </h2>

        {proposals.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#484f58" }}>
            No proposals yet. Submit a task to get started.
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
                  onClick={() => setSelectedProposal(
                    selectedProposal?.id === proposal.id ? null : proposal
                  )}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="card-title">{proposal.title}</div>
                      <div className="card-meta">
                        <span className={`status-tag status-${proposal.status === "merged" ? "closed" : proposal.status === "approved" ? "resolved" : proposal.status === "submitted" ? "open" : "in_progress"}`}>
                          {proposal.status}
                        </span>
                        <span>by {getAgentName(proposal.proposedBy)}</span>
                        <span>ID: {proposal.id}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Review progress */}
                      <div style={{ fontSize: 12, color: "#8b949e" }}>
                        {proposalReviews.length > 0 ? (
                          <span>
                            <span style={{ color: "#3fb950" }}>{approvedCount} approved</span>
                            {rejectedCount > 0 && <span style={{ color: "#f85149" }}>, {rejectedCount} rejected</span>}
                            <span>, {proposalReviews.length - approvedCount - rejectedCount} pending</span>
                          </span>
                        ) : "No reviewers"}
                      </div>

                      {/* Merge button */}
                      {proposal.status === "approved" && (
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={(e) => { e.stopPropagation(); handleMerge(proposal.id); }}
                        >
                          Merge
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

      {/* Selected Proposal Detail */}
      {selectedProposal && (
        <div className="panel">
          <h3 className="panel-title">{selectedProposal.title}</h3>
          <pre style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            color: "#c9d1d9",
            background: "#0d1117",
            padding: 16,
            borderRadius: 6,
            maxHeight: 300,
            overflowY: "auto",
            marginBottom: 12,
          }}>
            {selectedProposal.description}
          </pre>

          {/* Reviews for this proposal */}
          <h4 style={{ fontSize: 13, marginBottom: 8, color: "#8b949e" }}>
            Reviews ({getReviewsForProposal(selectedProposal.id).length})
          </h4>
          {getReviewsForProposal(selectedProposal.id).map(review => (
            <div key={review.id} style={{
              padding: "8px 12px",
              background: "#0d1117",
              borderRadius: 4,
              marginBottom: 6,
              fontSize: 12,
              borderLeft: `3px solid ${review.status === "approved" ? "#3fb950" : review.status === "rejected" ? "#f85149" : "#30363d"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{getAgentName(review.reviewerId)}</span>
                <span className={`status-tag status-${review.status === "approved" ? "open" : "in_progress"}`}>{review.status}</span>
              </div>
              {review.summary && <div style={{ color: "#8b949e", whiteSpace: "pre-wrap" }}>{review.summary}</div>}
            </div>
          ))}

          {/* Quick actions: human review or AI review */}
          {selectedProposal.status === "submitted" && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#8b949e" }}>Quick review by AI:</span>
              {reviewerAgents.map(agent => (
                <button
                  key={agent.id}
                  className="btn btn-secondary btn-xs"
                  onClick={() => handleAIReview(selectedProposal!, agent.id)}
                  disabled={agent.status === "working"}
                >
                  {agent.name}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "#484f58", marginLeft: 8 }}>
                or manually approve/reject below
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
