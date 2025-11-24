-- 1. Insert Team
INSERT INTO teams (team_name, conference, division, established, stadium)
VALUES ('Dallas Cowboys', 'NFC', 'NFC East', 1960, 'AT&T Stadium')
ON CONFLICT DO NOTHING;

-- 2. Insert Season (2025)
-- Note: Assuming team_id 1 is Cowboys because we just reset the DB
INSERT INTO seasons (team_id, year, wins, losses, ties, division_rank)
VALUES (1, 2025, 10, 5, 0, 1);

-- 3. Insert Recent Game Stats
INSERT INTO game_stats (season_id, week, game_date, is_home, points_scored, points_allowed, total_yards, passing_yards, rushing_yards, turnovers)
VALUES 
(1, 1, '2025-09-08', TRUE, 33, 17, 425, 302, 123, 1),
(1, 2, '2025-09-15', FALSE, 24, 21, 350, 250, 100, 0),
(1, 3, '2025-09-22', TRUE, 14, 28, 280, 200, 80, 2);

-- 4. Insert Players
INSERT INTO players (season_id, player_name, position, jersey_number, injury_status, performance_rating)
VALUES 
(1, 'Dak Prescott', 'QB', 4, 'Healthy', 89.5),
(1, 'CeeDee Lamb', 'WR', 88, 'Healthy', 94.2),
(1, 'Micah Parsons', 'LB', 11, 'Healthy', 96.0);

-- 5. Insert Initial Prediction (This fixes the /prediction/current error)
INSERT INTO predictions (season_id, playoff_probability, division_probability, conference_probability, superbowl_probability, model_version, confidence_score, factors_json)
VALUES (1, 0.75, 0.48, 0.22, 0.12, 'v2.0-Live', 88.5, '{"offense": "high", "defense": "stable"}');

-- 6. Insert Mock Users
INSERT INTO users (username, theme_preference)
VALUES ('CowboysFan99', 'cowboys');

-- 7. Insert Player Projections (For Radar Chart)
INSERT INTO player_projections (player_id, week, impact_index, skill_data)
VALUES 
(1, 1, 92.5, '[{"subject": "Passing", "A": 120, "fullMark": 150}, {"subject": "IQ", "A": 110, "fullMark": 150}]'),
(2, 1, 88.0, '[{"subject": "Speed", "A": 140, "fullMark": 150}, {"subject": "Catching", "A": 130, "fullMark": 150}]');
