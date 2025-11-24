-- KEEP YOUR EXISTING TABLES
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    conference VARCHAR(10),
    division VARCHAR(20),
    established INT,
    stadium VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS seasons (
    season_id SERIAL PRIMARY KEY,
    team_id INT,
    year INT NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    playoff_result VARCHAR(50),
    superbowl_win BOOLEAN DEFAULT FALSE,
    division_rank INT
);

CREATE TABLE IF NOT EXISTS game_stats (
    stat_id SERIAL PRIMARY KEY,
    season_id INT,
    week INT NOT NULL,
    game_date DATE,
    is_home BOOLEAN,
    points_scored INT,
    points_allowed INT,
    total_yards INT,
    passing_yards INT,
    rushing_yards INT,
    turnovers INT
);

CREATE TABLE IF NOT EXISTS predictions (
    prediction_id SERIAL PRIMARY KEY,
    season_id INT,
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    playoff_probability DECIMAL(5,2),
    division_probability DECIMAL(5,2),
    conference_probability DECIMAL(5,2),
    superbowl_probability DECIMAL(5,2),
    model_version VARCHAR(20),
    confidence_score DECIMAL(5,2),
    factors_json JSONB
);

-- === ADD THESE NEW TABLES TO FIX 500 ERROR ===
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    theme_preference VARCHAR(20) DEFAULT 'cowboys'
);

CREATE TABLE IF NOT EXISTS player_projections (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(100),
    impact_index DECIMAL(5,2),
    skill_data JSONB
);
