-- 1. TEAMS
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    conference VARCHAR(10) CHECK (conference IN ('NFC', 'AFC')),
    division VARCHAR(20),
    established INT,
    stadium VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SEASONS
CREATE TABLE IF NOT EXISTS seasons (
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

-- 3. GAME STATS
CREATE TABLE IF NOT EXISTS game_stats (
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

-- 4. PLAYERS (Needed for Radar Chart)
CREATE TABLE IF NOT EXISTS players (
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

-- 5. PREDICTIONS (Needed for Dashboard)
CREATE TABLE IF NOT EXISTS predictions (
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

-- 6. USERS (New Feature: User Profiles)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    theme_preference VARCHAR(20) DEFAULT 'cowboys',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. PLAYER PROJECTIONS (New Feature: Impact Index/Radar)
CREATE TABLE IF NOT EXISTS player_projections (
    proj_id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(player_id),
    week INT,
    impact_index DECIMAL(5,2),
    skill_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. SIMULATIONS (New Feature: Story Simulator)
CREATE TABLE IF NOT EXISTS simulations (
    sim_id SERIAL PRIMARY KEY,
    user_id INT,
    scenario_type VARCHAR(50),
    result_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
