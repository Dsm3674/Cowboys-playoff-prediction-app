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

-- == NEW TABLES FOR PDF FEATURES == --

-- Feature 4: User Profiles & Alerts
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255),
    theme_preference VARCHAR(20) DEFAULT 'cowboys',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature 10: Community Engagement
CREATE TABLE community_votes (
    vote_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    season_id INT,
    week INT,
    prediction_winner VARCHAR(50),
    confidence_level INT
);

-- Feature 11: Player Score Impact Index (PSII)
CREATE TABLE player_impact_metrics (
    metric_id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(player_id),
    week INT,
    impact_index DECIMAL(5,2),
    radar_data JSONB, -- Stores Skill Areas for Feature 5
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seasons_year ON seasons(year);
CREATE INDEX idx_game_stats_season ON game_stats(season_id);
