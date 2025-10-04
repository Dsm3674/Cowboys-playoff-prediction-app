CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    conference VARCHAR(10) CHECK (conference IN ('NFC', 'AFC')),
    division VARCHAR(20),
    established INT,
    stadium VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seasons (
    season_id SERIAL PRIMARY KEY,
    team_id INT REFERENCES teams(team_id) ON DELETE CASCADE,
    year INT NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    playoff_result VARCHAR(50),
    superbowl_win BOOLEAN DEFAULT FALSE,
    division_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, year)
);

CREATE TABLE game_stats (
    stat_id SERIAL PRIMARY KEY,
    season_id INT REFERENCES seasons(season_id) ON DELETE CASCADE,
    week INT NOT NULL,
    game_date DATE,
    is_home BOOLEAN,
    points_scored INT,
    points_allowed INT,
    total_yards INT,
    passing_yards INT,
    rushing_yards INT,
    turnovers INT,
    time_of_possession DECIMAL(4,2),
    third_down_efficiency DECIMAL(5,2),
    red_zone_efficiency DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
    player_id SERIAL PRIMARY KEY,
    season_id INT REFERENCES seasons(season_id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    position VARCHAR(20),
    jersey_number INT,
    injury_status VARCHAR(50) DEFAULT 'Healthy',
    performance_rating DECIMAL(5,2),
    games_played INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE opponents (
    opponent_id SERIAL PRIMARY KEY,
    stat_id INT REFERENCES game_stats(stat_id) ON DELETE CASCADE,
    opponent_name VARCHAR(100) NOT NULL,
    strength_rating DECIMAL(5,2),
    opponent_wins INT,
    opponent_losses INT,
    win_probability DECIMAL(5,2)
);

CREATE TABLE predictions (
    prediction_id SERIAL PRIMARY KEY,
    season_id INT REFERENCES seasons(season_id) ON DELETE CASCADE,
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    playoff_probability DECIMAL(5,2),
    division_probability DECIMAL(5,2),
    conference_probability DECIMAL(5,2),
    superbowl_probability DECIMAL(5,2),
    model_version VARCHAR(20),
    confidence_score DECIMAL(5,2),
    factors_json JSONB
);

CREATE INDEX idx_seasons_year ON seasons(year);
CREATE INDEX idx_game_stats_season ON game_stats(season_id);
CREATE INDEX idx_players_season ON players(season_id);
CREATE INDEX idx_predictions_date ON predictions(prediction_date);

CREATE VIEW latest_predictions AS
SELECT 
    p.prediction_id,
    t.team_name,
    s.year,
    s.wins,
    s.losses,
    p.playoff_probability,
    p.superbowl_probability,
    p.prediction_date
FROM predictions p
JOIN seasons s ON p.season_id = s.season_id
JOIN teams t ON s.team_id = t.team_id
WHERE p.prediction_date = (
    SELECT MAX(prediction_date) 
    FROM predictions 
    WHERE season_id = p.season_id
);