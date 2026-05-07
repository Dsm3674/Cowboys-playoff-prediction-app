-- Idempotent seed data for local/Railway initialization.

INSERT INTO teams (team_name, conference, division, established, stadium)
SELECT 'Dallas Cowboys', 'NFC', 'NFC East', 1960, 'AT&T Stadium'
WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE team_name = 'Dallas Cowboys'
);

INSERT INTO seasons (team_id, year, wins, losses, ties, division_rank)
SELECT team_id, 2025, 10, 5, 0, 1
FROM teams
WHERE team_name = 'Dallas Cowboys'
ON CONFLICT (team_id, year) DO UPDATE SET
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    ties = EXCLUDED.ties,
    division_rank = EXCLUDED.division_rank;

INSERT INTO game_stats (
    season_id,
    week,
    game_date,
    is_home,
    points_scored,
    points_allowed,
    total_yards,
    passing_yards,
    rushing_yards,
    turnovers
)
SELECT s.season_id, v.week, v.game_date::date, v.is_home, v.points_scored, v.points_allowed,
       v.total_yards, v.passing_yards, v.rushing_yards, v.turnovers
FROM seasons s
JOIN teams t ON t.team_id = s.team_id
JOIN (
    VALUES
      (1, '2025-09-08', TRUE, 33, 17, 425, 302, 123, 1),
      (2, '2025-09-15', FALSE, 24, 21, 350, 250, 100, 0),
      (3, '2025-09-22', TRUE, 14, 28, 280, 200, 80, 2)
) AS v(week, game_date, is_home, points_scored, points_allowed, total_yards, passing_yards, rushing_yards, turnovers)
ON t.team_name = 'Dallas Cowboys' AND s.year = 2025
WHERE NOT EXISTS (
    SELECT 1 FROM game_stats gs
    WHERE gs.season_id = s.season_id AND gs.week = v.week
);

INSERT INTO players (season_id, player_name, position, jersey_number, injury_status, performance_rating)
SELECT s.season_id, v.player_name, v.position, v.jersey_number, v.injury_status, v.performance_rating
FROM seasons s
JOIN teams t ON t.team_id = s.team_id
JOIN (
    VALUES
      ('Dak Prescott', 'QB', 4, 'Healthy', 89.5::decimal),
      ('CeeDee Lamb', 'WR', 88, 'Healthy', 94.2::decimal),
      ('Micah Parsons', 'LB', 11, 'Healthy', 96.0::decimal)
) AS v(player_name, position, jersey_number, injury_status, performance_rating)
ON t.team_name = 'Dallas Cowboys' AND s.year = 2025
WHERE NOT EXISTS (
    SELECT 1 FROM players p
    WHERE p.season_id = s.season_id AND p.player_name = v.player_name
);

INSERT INTO predictions (
    season_id,
    playoff_probability,
    division_probability,
    conference_probability,
    superbowl_probability,
    model_version,
    confidence_score,
    factors_json
)
SELECT s.season_id, 0.75, 0.48, 0.22, 0.12, 'v2.0-Live', 88.5, '{"offense": "high", "defense": "stable"}'::jsonb
FROM seasons s
JOIN teams t ON t.team_id = s.team_id
WHERE t.team_name = 'Dallas Cowboys'
  AND s.year = 2025
  AND NOT EXISTS (
    SELECT 1 FROM predictions p
    WHERE p.season_id = s.season_id AND p.model_version = 'v2.0-Live'
  );

INSERT INTO users (username, theme_preference)
VALUES ('CowboysFan99', 'cowboys')
ON CONFLICT (username) DO NOTHING;

INSERT INTO player_projections (player_id, week, impact_index, skill_data)
SELECT p.player_id, v.week, v.impact_index, v.skill_data::jsonb
FROM players p
JOIN (
    VALUES
      ('Dak Prescott', 1, 92.5::decimal, '[{"subject": "Passing", "A": 120, "fullMark": 150}, {"subject": "IQ", "A": 110, "fullMark": 150}]'),
      ('CeeDee Lamb', 1, 88.0::decimal, '[{"subject": "Speed", "A": 140, "fullMark": 150}, {"subject": "Catching", "A": 130, "fullMark": 150}]')
) AS v(player_name, week, impact_index, skill_data)
ON p.player_name = v.player_name
WHERE NOT EXISTS (
    SELECT 1 FROM player_projections pp
    WHERE pp.player_id = p.player_id AND pp.week = v.week
);
