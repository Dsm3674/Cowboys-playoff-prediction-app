-- Idempotent seed data for local/Railway initialization.

INSERT INTO teams (team_name, conference, division, established, stadium)
SELECT 'Dallas Cowboys', 'NFC', 'NFC East', 1960, 'AT&T Stadium'
WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE team_name = 'Dallas Cowboys'
);

INSERT INTO seasons (team_id, year, wins, losses, ties, division_rank)
SELECT team_id, 2027, 0, 0, 0, 1
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
      (1, '2027-09-09', TRUE, 33, 17, 425, 302, 123, 1),
      (2, '2027-09-16', FALSE, 24, 21, 350, 250, 100, 0),
      (3, '2027-09-23', TRUE, 14, 28, 280, 200, 80, 2)
) AS v(week, game_date, is_home, points_scored, points_allowed, total_yards, passing_yards, rushing_yards, turnovers)
ON t.team_name = 'Dallas Cowboys' AND s.year = 2027
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
      ('Israel Abanikanda', 'RB', 30, 'Healthy', 78.0::decimal),
      ('Bryan Anger', 'P', 5, 'Healthy', 78.0::decimal),
      ('Brandon Aubrey', 'K', 17, 'Healthy', 91.0::decimal),
      ('Jaishawn Barham', 'LB', 55, 'Healthy', 78.0::decimal),
      ('Justin Barron', 'LB', 45, 'Healthy', 78.0::decimal),
      ('TJ Bass', 'OT', 66, 'Healthy', 78.0::decimal),
      ('Cooper Beebe', 'G', 56, 'Healthy', 82.0::decimal),
      ('Markquese Bell', 'SAF', 14, 'Healthy', 78.0::decimal),
      ('DaRon Bland', 'CB', 26, 'Healthy', 90.5::decimal),
      ('Jaydon Blue', 'RB', 23, 'Healthy', 78.0::decimal),
      ('Tyler Booker', 'G', 52, 'Healthy', 81.0::decimal),
      ('Trikweze Bridges', 'DB', 25, 'Healthy', 78.0::decimal),
      ('Camden Brown', 'WR', 6, 'Healthy', 78.0::decimal),
      ('Jonathan Bullard', 'DE', 98, 'Healthy', 78.0::decimal),
      ('Josh Butler', 'DB', 31, 'Healthy', 78.0::decimal),
      ('Caelen Carson', 'DB', 21, 'Healthy', 78.0::decimal),
      ('Zion Childress', 'DB', 48, 'Healthy', 78.0::decimal),
      ('Alijah Clark', 'DB', 38, 'Healthy', 78.0::decimal),
      ('Kenny Clark', 'NT', 97, 'Healthy', 87.5::decimal),
      ('Ajani Cornelius', 'OT', 65, 'Healthy', 78.0::decimal),
      ('Malik Davis', 'RB', 20, 'Healthy', 78.0::decimal),
      ('Caleb Downs', 'SAF', 13, 'Healthy', 78.0::decimal),
      ('Tommy Dunn', 'DT', 95, 'Healthy', 78.0::decimal),
      ('Cobie Durant', 'CB', 2, 'Healthy', 78.0::decimal),
      ('Donovan Ezeiruaku', 'LB', 6, 'Healthy', 78.0::decimal),
      ('Princeton Fant', 'TE', 85, 'Healthy', 78.0::decimal),
      ('Jake Ferguson', 'TE', 87, 'Healthy', 84.0::decimal),
      ('Ryan Flournoy', 'WR', 19, 'Healthy', 78.0::decimal),
      ('Rashan Gary', 'LB', 7, 'Healthy', 90.0::decimal),
      ('Kelvin Gilliam', 'DT', 94, 'Healthy', 78.0::decimal),
      ('Tyler Guyton', 'OT', 60, 'Healthy', 81.0::decimal),
      ('Traeshon Holden', 'WR', 80, 'Healthy', 78.0::decimal),
      ('Malik Hooker', 'FS', 24, 'Healthy', 83.0::decimal),
      ('James Houston', 'LB', 41, 'Healthy', 78.0::decimal),
      ('Sam Howell', 'QB', 16, 'Healthy', 78.0::decimal),
      ('Jordan Hudson', 'WR', 18, 'Healthy', 78.0::decimal),
      ('Shemar James', 'LB', 50, 'Healthy', 78.0::decimal),
      ('Marcellus Johnson', 'OT', 79, 'Healthy', 78.0::decimal),
      ('Tyler Johnson', 'WR', 15, 'Healthy', 78.0::decimal),
      ('Trevor Keegan', 'G', 77, 'Healthy', 78.0::decimal),
      ('Derion Kendrick', 'CB', 15, 'Healthy', 78.0::decimal),
      ('CeeDee Lamb', 'WR', 88, 'Healthy', 94.5::decimal),
      ('Isaiah Land', 'LB', 58, 'Healthy', 78.0::decimal),
      ('Malachi Lawrence', 'LB', 57, 'Healthy', 78.0::decimal),
      ('Nick Leverett', 'G', 51, 'Healthy', 78.0::decimal),
      ('Marist Liufau', 'LB', 35, 'Healthy', 78.0::decimal),
      ('P.J. Locke', 'DB', 1, 'Healthy', 78.0::decimal),
      ('Hunter Luepke', 'RB', 40, 'Healthy', 78.0::decimal),
      ('Phil Mafah', 'RB', 37, 'Healthy', 78.0::decimal),
      ('Joe Milton III', 'QB', 10, 'Healthy', 78.0::decimal),
      ('Denzel Mims', 'WR', 84, 'Healthy', 78.0::decimal),
      ('Jonathan Mingo', 'WR', 81, 'Healthy', 78.0::decimal),
      ('Devin Moore', 'CB', 29, 'Healthy', 78.0::decimal),
      ('Adedayo Odeleye', 'DE', 96, 'Healthy', 78.0::decimal),
      ('Otito Ogbonnia', 'DT', 91, 'Healthy', 78.0::decimal),
      ('LT Overton', 'DE', 99, 'Healthy', 78.0::decimal),
      ('Langston Patterson', 'LB', 47, 'Healthy', 78.0::decimal),
      ('Shiyazh Pete', 'OT', 75, 'Healthy', 78.0::decimal),
      ('George Pickens', 'WR', 3, 'Healthy', 89.0::decimal),
      ('Dak Prescott', 'QB', 4, 'Healthy', 90.0::decimal),
      ('Shavon Revel Jr.', 'CB', 28, 'Healthy', 78.0::decimal),
      ('Dominic Richardson', 'RB', 43, 'Healthy', 78.0::decimal),
      ('Curtis Robinson', 'LB', 42, 'Healthy', 78.0::decimal),
      ('DJ Rogers', 'TE', 49, 'Healthy', 78.0::decimal),
      ('Luke Schoonmaker', 'TE', 86, 'Healthy', 78.0::decimal),
      ('Drew Shelton', 'OT', 67, 'Healthy', 78.0::decimal),
      ('Trent Sieg', 'LS', 44, 'Healthy', 78.0::decimal),
      ('Anthony Smith', 'WR', 83, 'Healthy', 78.0::decimal),
      ('Jaden Smith', 'WR', 17, 'Healthy', 78.0::decimal),
      ('Tyler Smith', 'OT', 73, 'Healthy', 88.0::decimal),
      ('Charles Snowden', 'LB', 49, 'Healthy', 78.0::decimal),
      ('Brevyn Spann-Ford', 'TE', 89, 'Healthy', 78.0::decimal),
      ('Ameer Speed', 'CB', 39, 'Healthy', 78.0::decimal),
      ('Terence Steele', 'OT', 78, 'Healthy', 84.0::decimal),
      ('Reddy Steward', 'DB', 27, 'Healthy', 78.0::decimal),
      ('Nathan Thomas', 'OT', 71, 'Healthy', 78.0::decimal),
      ('Jalen Thompson', 'DB', 34, 'Healthy', 82.0::decimal),
      ('Jay Toia', 'DT', 93, 'Healthy', 78.0::decimal),
      ('Michael Trigg', 'TE', 46, 'Healthy', 78.0::decimal),
      ('KaVontae Turpin', 'WR', 9, 'Healthy', 82.0::decimal),
      ('Marquez Valdes-Scantling', 'WR', 11, 'Healthy', 78.0::decimal),
      ('Tyrus Wheat', 'LB', 90, 'Healthy', 78.0::decimal),
      ('Quinnen Williams', 'DT', 92, 'Healthy', 93.0::decimal),
      ('Javonte Williams', 'RB', 33, 'Healthy', 78.0::decimal),
      ('Sam Williams', 'LB', 54, 'Healthy', 78.0::decimal),
      ('DJ Wingfield', 'G', 64, 'Healthy', 78.0::decimal),
      ('Dee Winters', 'LB', 53, 'Healthy', 78.0::decimal),
      ('DJ Withers', 'DT', 59, 'Healthy', 78.0::decimal),
      ('Julius Wood', 'SAF', 32, 'Healthy', 78.0::decimal),
      ('Matt Hennessy', 'C', 72, 'Healthy', 80.0::decimal)
) AS v(player_name, position, jersey_number, injury_status, performance_rating)
ON t.team_name = 'Dallas Cowboys' AND s.year = 2027
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
  AND s.year = 2027
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
  AND (SELECT year FROM seasons s WHERE s.season_id = p.season_id) = 2027
WHERE NOT EXISTS (
    SELECT 1 FROM player_projections pp
    WHERE pp.player_id = p.player_id AND pp.week = v.week
);
