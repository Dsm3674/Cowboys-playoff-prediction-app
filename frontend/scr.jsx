import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Trophy,
  Users,
  BarChart3,
  RefreshCw,
  Activity,
  TrendingUp,
} from "lucide-react";

const TeamDashboard = () => {
  const [activeTab, setActiveTab] = useState("prediction");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [gameStats, setGameStats] = useState([]);

  // Use Vite environment variable
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  useEffect(() => {
    fetchCurrentData();
    fetchHistory();
  }, []);

  const fetchCurrentData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/predictions/current`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSeasonData(data.season);
      setPrediction(data.prediction);
      setPlayers(data.players || []);
      setGameStats(data.gameStats || []);
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
      console.error("Error fetching current data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/predictions/history`);
      
      if (!response.ok) {
        console.error(`Failed to fetch history: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const generateNewPrediction = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/predictions/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        await fetchCurrentData();
        await fetchHistory();
      }
    } catch (err) {
      setError(`Failed to generate prediction: ${err.message}`);
      console.error("Error generating prediction:", err);
    } finally {
      setLoading(false);
    }
  };

  const getColorClass = (value) => {
    if (value >= 70) return "text-green-400";
    if (value >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressColor = (value) => {
    if (value >= 70) return "bg-green-400";
    if (value >= 40) return "bg-yellow-400";
    return "bg-red-400";
  };

  const getInjuryStatusColor = (status) => {
    if (!status) return "text-gray-400";
    switch (status.toLowerCase()) {
      case "healthy":
        return "text-green-400";
      case "questionable":
        return "text-yellow-400";
      case "out":
      case "injured":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const parseFactor = (factors) => {
    try {
      return typeof factors === "string" ? JSON.parse(factors) : factors;
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-2">
            Dallas Cowboys Super Bowl Predictor
          </h1>
          <p className="text-gray-300 text-lg">
            Advanced analytics and prediction modeling
          </p>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        <div className="flex gap-2 mb-6 bg-white/10 backdrop-blur-md rounded-xl p-2">
          <button
            onClick={() => setActiveTab("prediction")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === "prediction"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <Trophy className="w-5 h-5 inline mr-2" />
            Predictions
          </button>
          <button
            onClick={() => setActiveTab("players")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === "players"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Players
          </button>
          <button
            onClick={() => setActiveTab("games")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === "games"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <BarChart3 className="w-5 h-5 inline mr-2" />
            Game Stats
          </button>
        </div>

        {seasonData && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              {seasonData.year} Season • {seasonData.team_name}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-4xl font-bold text-green-400">
                  {seasonData.wins}
                </div>
                <div className="text-gray-300 mt-1">Wins</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-4xl font-bold text-red-400">
                  {seasonData.losses}
                </div>
                <div className="text-gray-300 mt-1">Losses</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-4xl font-bold text-blue-400">
                  {seasonData.division_rank || "N/A"}
                </div>
                <div className="text-gray-300 mt-1">Division Rank</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-4xl font-bold text-purple-400">
                  {seasonData.wins + seasonData.losses > 0
                    ? (
                        (seasonData.wins /
                          (seasonData.wins + seasonData.losses)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
                <div className="text-gray-300 mt-1">Win Rate</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "prediction" && (
          <>
            {prediction ? (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h2 className="text-3xl font-bold text-white">
                    Super Bowl Probability Analysis
                  </h2>
                  <button
                    onClick={generateNewPrediction}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 transition-all"
                  >
                    <RefreshCw
                      className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                    />
                    {loading ? "Calculating..." : "Refresh Prediction"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white/5 rounded-xl p-6 text-center">
                    <Activity className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                    <div
                      className={`text-5xl font-bold mb-2 ${getColorClass(
                        prediction.playoff_probability
                      )}`}
                    >
                      {prediction.playoff_probability}%
                    </div>
                    <div className="text-gray-300 text-lg mb-3">
                      Make Playoffs
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(
                          prediction.playoff_probability
                        )}`}
                        style={{
                          width: `${prediction.playoff_probability}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-6 text-center">
                    <TrendingUp className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                    <div
                      className={`text-5xl font-bold mb-2 ${getColorClass(
                        prediction.division_probability
                      )}`}
                    >
                      {prediction.division_probability}%
                    </div>
                    <div className="text-gray-300 text-lg mb-3">
                      Win Division
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(
                          prediction.division_probability
                        )}`}
                        style={{
                          width: `${prediction.division_probability}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-6 text-center">
                    <Trophy className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                    <div
                      className={`text-5xl font-bold mb-2 ${getColorClass(
                        prediction.conference_probability
                      )}`}
                    >
                      {prediction.conference_probability}%
                    </div>
                    <div className="text-gray-300 text-lg mb-3">Win NFC</div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(
                          prediction.conference_probability
                        )}`}
                        style={{
                          width: `${prediction.conference_probability}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-6 text-center border-2 border-yellow-400">
                    <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-3 animate-pulse" />
                    <div
                      className={`text-5xl font-bold mb-2 ${getColorClass(
                        prediction.superbowl_probability
                      )}`}
                    >
                      {prediction.superbowl_probability}%
                    </div>
                    <div className="text-yellow-400 text-lg mb-3 font-bold">
                      Win Super Bowl
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressColor(
                          prediction.superbowl_probability
                        )}`}
                        style={{
                          width: `${prediction.superbowl_probability}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {prediction.factors_json && (() => {
                  const factors = parseFactor(prediction.factors_json);
                  return factors ? (
                    <div className="bg-white/5 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4">
                        Analysis Factors
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(factors).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="text-2xl font-bold text-blue-400">
                              {value}
                            </div>
                            <div className="text-gray-400 text-sm capitalize">
                              {key.replace(/_/g, " ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="mt-6 text-sm text-gray-400 text-center">
                  Model: {prediction.model_version} | Confidence:{" "}
                  {prediction.confidence_score}% | Updated:{" "}
                  {new Date(prediction.prediction_date).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-6 text-center">
                <p className="text-gray-300 text-lg mb-4">
                  No prediction available yet
                </p>
                <button
                  onClick={generateNewPrediction}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 transition-all"
                >
                  {loading ? "Generating..." : "Generate Prediction"}
                </button>
              </div>
            )}

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <h3 className="text-2xl font-bold text-white mb-4">
                Prediction History
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.length > 0 ? (
                  history.map((pred) => (
                    <div
                      key={pred.prediction_id}
                      className="bg-white/5 rounded-lg p-4 flex flex-wrap justify-between items-center hover:bg-white/10 transition-all gap-4"
                    >
                      <div className="text-gray-300 text-sm">
                        {new Date(pred.prediction_date).toLocaleString()}
                      </div>
                      <div className="flex gap-6 flex-wrap">
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Playoffs</div>
                          <div className="text-white font-bold">
                            {pred.playoff_probability}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Division</div>
                          <div className="text-white font-bold">
                            {pred.division_probability}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">NFC</div>
                          <div className="text-white font-bold">
                            {pred.conference_probability}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">
                            Super Bowl
                          </div>
                          <div className="text-yellow-400 font-bold">
                            {pred.superbowl_probability}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    No prediction history available
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "players" && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4">
              Key Players & Injury Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.length > 0 ? (
                players.map((player) => (
                  <div
                    key={player.player_id}
                    className="bg-white/5 rounded-lg p-4 flex justify-between items-center hover:bg-white/10 transition-all"
                  >
                    <div>
                      <div className="text-white font-bold text-lg">
                        #{player.jersey_number} {player.player_name}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {player.position}
                      </div>
                      <div
                        className={`text-sm font-semibold ${getInjuryStatusColor(
                          player.injury_status
                        )}`}
                      >
                        {player.injury_status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-400">
                        {player.performance_rating}
                      </div>
                      <div className="text-gray-400 text-xs">Rating</div>
                      <div className="text-gray-300 text-sm mt-1">
                        {player.games_played} GP
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center text-gray-400 py-8">
                  No player data available
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "games" && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4">
              Game Statistics
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {gameStats.length > 0 ? (
                gameStats.map((game) => (
                  <div
                    key={game.stat_id}
                    className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all"
                  >
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                      <div>
                        <span className="text-white font-bold">
                          Week {game.week}
                        </span>
                        <span className="text-gray-400 ml-3">
                          {new Date(game.game_date).toLocaleDateString()}
                        </span>
                        <span
                          className={`ml-3 text-sm ${
                            game.is_home ? "text-blue-400" : "text-gray-400"
                          }`}
                        >
                          {game.is_home ? "Home" : "Away"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-2xl font-bold ${
                            game.points_scored > game.points_allowed
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {game.points_scored}
                        </span>
                        <span className="text-gray-400 mx-2">-</span>
                        <span className="text-2xl font-bold text-gray-300">
                          {game.points_allowed}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <div className="text-gray-400">Yards</div>
                        <div className="text-white font-semibold">
                          {game.total_yards}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Passing</div>
                        <div className="text-white font-semibold">
                          {game.passing_yards}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Rushing</div>
                        <div className="text-white font-semibold">
                          {game.rushing_yards}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Turnovers</div>
                        <div className="text-white font-semibold">
                          {game.turnovers}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No game statistics available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDashboard;