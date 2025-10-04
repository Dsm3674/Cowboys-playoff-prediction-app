INSERT INTO teams (team_name, conference, division, established, stadium)
VALUES ('Dallas Cowboys', 'NFC', 'NFC East', 1960, 'AT&T Stadium');

INSERT INTO seasons (team_id, year, wins, losses, ties, division_rank)
VALUES (1, 2024, 8, 5, 0, 2);

INSERT INTO game_stats (season_id, week, game_date, is_home, points_scored, points_allowed, total_yards, passing_yards, rushing_yards, turnovers, third_down_efficiency, red_zone_efficiency)
VALUES 
(1, 1, '2024-09-08', TRUE, 33, 17, 425, 302, 123, 1, 45.5, 66.7),
(1, 2, '2024-09-15', FALSE, 19, 44, 356, 275, 81, 3, 35.2, 42.3),
(1, 3, '2024-09-22', TRUE, 38, 10, 448, 331, 117, 0, 52.3, 80.0);

INSERT INTO players (season_id, player_name, position, jersey_number, injury_status, performance_rating, games_played)
VALUES 
(1, 'Dak Prescott', 'QB', 4, 'Healthy', 87.5, 13),
(1, 'CeeDee Lamb', 'WR', 88, 'Healthy', 92.3, 13),
(1, 'DeMarcus Lawrence', 'DE', 90, 'Injured', 78.2, 8);

INSERT INTO predictions (season_id, playoff_probability, division_probability, conference_probability, superbowl_probability, model_version, confidence_score, factors_json)
VALUES (1, 72.5, 45.3, 18.7, 8.2, 'v2.1', 84.5, 
'{"offensive_rating": 85, "defensive_rating": 72, "injury_impact": -12, "win_percentage": 61.5}');

