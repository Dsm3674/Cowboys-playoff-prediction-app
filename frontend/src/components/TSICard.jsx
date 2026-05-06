import React from "react";
import { api } from "../api";

function TSICard({ year, team = "DAL" }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    api.getTSI(team, year)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, team]);

  if (loading) return <div className="card">Loading TSI...</div>;
  if (!data) return null;

  const tsiColor = data.tsi >= 55 ? "#059669" : data.tsi >= 45 ? "#d97706" : "#dc2626";

  return (
    <div className="card tsi-card">
      <div className="eyebrow">Team Strength Index</div>
      <h3 className="tsi-card__title">{team} Power Rating</h3>
      
      <div className="tsi-card__hero">
        <div style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          color: tsiColor,
          lineHeight: 1
        }}>
          {data.tsi}
        </div>
        <div className="tsi-card__scale">
          / 100<br/>Scale
        </div>
      </div>

      <div className="tsi-card__grid">
        <div className="tsi-card__metric">
          <strong>Offense:</strong> {data.components.offense}
        </div>
        <div className="tsi-card__metric">
          <strong>Defense:</strong> {data.components.defense}
        </div>
        <div className="tsi-card__metric">
          <strong>Schedule:</strong> {data.components.schedule}
        </div>
        <div className="tsi-card__metric">
          <strong>QB Adj:</strong> {data.components.qbAdj}
        </div>
      </div>
    </div>
  );
}

// Export to global scope for main.jsx
window.TSICard = TSICard;

export default TSICard;
