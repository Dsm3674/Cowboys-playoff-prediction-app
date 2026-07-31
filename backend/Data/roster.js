"use strict";

/**
 * roster
 * The single source of truth for the Cowboys roster used by the analytics
 * engines (clutch index, performance map, player radar).
 *
 * Generated from backend/Data/seed.sql, which carries the same 90-man roster
 * the database is seeded with. __tests__/roster.test.js asserts the two stay
 * in sync, because the previous arrangement — a hand-maintained ROSTER_MAP of
 * 48 name regexes inside routes/players.js — silently rotted the moment the
 * roster changed. When that list was last checked, 29 of its 48 players were
 * no longer on the team and 71 of the 90 actual players had no entry at all,
 * so the clutch and map pages could never show more than 19 of the roster.
 *
 * To update: change seed.sql, then re-run `node scripts/generate-roster.js`.
 */

/* eslint-disable */
module.exports = [
  {
    "name": "Israel Abanikanda",
    "pos": "RB",
    "num": 30,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Bryan Anger",
    "pos": "P",
    "num": 5,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Brandon Aubrey",
    "pos": "K",
    "num": 17,
    "status": "Healthy",
    "rating": 91
  },
  {
    "name": "Jaishawn Barham",
    "pos": "LB",
    "num": 55,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Justin Barron",
    "pos": "LB",
    "num": 45,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "TJ Bass",
    "pos": "OT",
    "num": 66,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Cooper Beebe",
    "pos": "G",
    "num": 56,
    "status": "Healthy",
    "rating": 82
  },
  {
    "name": "Markquese Bell",
    "pos": "SAF",
    "num": 14,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "DaRon Bland",
    "pos": "CB",
    "num": 26,
    "status": "Healthy",
    "rating": 90.5
  },
  {
    "name": "Jaydon Blue",
    "pos": "RB",
    "num": 23,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tyler Booker",
    "pos": "G",
    "num": 52,
    "status": "Healthy",
    "rating": 81
  },
  {
    "name": "Trikweze Bridges",
    "pos": "DB",
    "num": 25,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Camden Brown",
    "pos": "WR",
    "num": 6,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jonathan Bullard",
    "pos": "DE",
    "num": 98,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Josh Butler",
    "pos": "DB",
    "num": 31,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Caelen Carson",
    "pos": "DB",
    "num": 21,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Zion Childress",
    "pos": "DB",
    "num": 48,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Alijah Clark",
    "pos": "DB",
    "num": 38,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Kenny Clark",
    "pos": "NT",
    "num": 97,
    "status": "Healthy",
    "rating": 87.5
  },
  {
    "name": "Ajani Cornelius",
    "pos": "OT",
    "num": 65,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Malik Davis",
    "pos": "RB",
    "num": 20,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Caleb Downs",
    "pos": "SAF",
    "num": 13,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tommy Dunn",
    "pos": "DT",
    "num": 95,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Cobie Durant",
    "pos": "CB",
    "num": 2,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Donovan Ezeiruaku",
    "pos": "LB",
    "num": 6,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Princeton Fant",
    "pos": "TE",
    "num": 85,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jake Ferguson",
    "pos": "TE",
    "num": 87,
    "status": "Healthy",
    "rating": 84
  },
  {
    "name": "Ryan Flournoy",
    "pos": "WR",
    "num": 19,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Rashan Gary",
    "pos": "LB",
    "num": 7,
    "status": "Healthy",
    "rating": 90
  },
  {
    "name": "Kelvin Gilliam",
    "pos": "DT",
    "num": 94,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tyler Guyton",
    "pos": "OT",
    "num": 60,
    "status": "Healthy",
    "rating": 81
  },
  {
    "name": "Traeshon Holden",
    "pos": "WR",
    "num": 80,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Malik Hooker",
    "pos": "FS",
    "num": 24,
    "status": "Healthy",
    "rating": 83
  },
  {
    "name": "James Houston",
    "pos": "LB",
    "num": 41,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Sam Howell",
    "pos": "QB",
    "num": 16,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jordan Hudson",
    "pos": "WR",
    "num": 18,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Shemar James",
    "pos": "LB",
    "num": 50,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Marcellus Johnson",
    "pos": "OT",
    "num": 79,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tyler Johnson",
    "pos": "WR",
    "num": 15,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Trevor Keegan",
    "pos": "G",
    "num": 77,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Derion Kendrick",
    "pos": "CB",
    "num": 15,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "CeeDee Lamb",
    "pos": "WR",
    "num": 88,
    "status": "Healthy",
    "rating": 94.5
  },
  {
    "name": "Isaiah Land",
    "pos": "LB",
    "num": 58,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Malachi Lawrence",
    "pos": "LB",
    "num": 57,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Nick Leverett",
    "pos": "G",
    "num": 51,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Marist Liufau",
    "pos": "LB",
    "num": 35,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "P.J. Locke",
    "pos": "DB",
    "num": 1,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Hunter Luepke",
    "pos": "RB",
    "num": 40,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Phil Mafah",
    "pos": "RB",
    "num": 37,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Joe Milton III",
    "pos": "QB",
    "num": 10,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Denzel Mims",
    "pos": "WR",
    "num": 84,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jonathan Mingo",
    "pos": "WR",
    "num": 81,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Devin Moore",
    "pos": "CB",
    "num": 29,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Adedayo Odeleye",
    "pos": "DE",
    "num": 96,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Otito Ogbonnia",
    "pos": "DT",
    "num": 91,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "LT Overton",
    "pos": "DE",
    "num": 99,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Langston Patterson",
    "pos": "LB",
    "num": 47,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Shiyazh Pete",
    "pos": "OT",
    "num": 75,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "George Pickens",
    "pos": "WR",
    "num": 3,
    "status": "Healthy",
    "rating": 89
  },
  {
    "name": "Dak Prescott",
    "pos": "QB",
    "num": 4,
    "status": "Healthy",
    "rating": 90
  },
  {
    "name": "Shavon Revel Jr.",
    "pos": "CB",
    "num": 28,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Dominic Richardson",
    "pos": "RB",
    "num": 43,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Curtis Robinson",
    "pos": "LB",
    "num": 42,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "DJ Rogers",
    "pos": "TE",
    "num": 49,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Luke Schoonmaker",
    "pos": "TE",
    "num": 86,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Drew Shelton",
    "pos": "OT",
    "num": 67,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Trent Sieg",
    "pos": "LS",
    "num": 44,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Anthony Smith",
    "pos": "WR",
    "num": 83,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jaden Smith",
    "pos": "WR",
    "num": 17,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tyler Smith",
    "pos": "OT",
    "num": 73,
    "status": "Healthy",
    "rating": 88
  },
  {
    "name": "Charles Snowden",
    "pos": "LB",
    "num": 49,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Brevyn Spann-Ford",
    "pos": "TE",
    "num": 89,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Ameer Speed",
    "pos": "CB",
    "num": 39,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Terence Steele",
    "pos": "OT",
    "num": 78,
    "status": "Healthy",
    "rating": 84
  },
  {
    "name": "Reddy Steward",
    "pos": "DB",
    "num": 27,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Nathan Thomas",
    "pos": "OT",
    "num": 71,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Jalen Thompson",
    "pos": "DB",
    "num": 34,
    "status": "Healthy",
    "rating": 82
  },
  {
    "name": "Jay Toia",
    "pos": "DT",
    "num": 93,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Michael Trigg",
    "pos": "TE",
    "num": 46,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "KaVontae Turpin",
    "pos": "WR",
    "num": 9,
    "status": "Healthy",
    "rating": 82
  },
  {
    "name": "Marquez Valdes-Scantling",
    "pos": "WR",
    "num": 11,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Tyrus Wheat",
    "pos": "LB",
    "num": 90,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Quinnen Williams",
    "pos": "DT",
    "num": 92,
    "status": "Healthy",
    "rating": 93
  },
  {
    "name": "Javonte Williams",
    "pos": "RB",
    "num": 33,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Sam Williams",
    "pos": "LB",
    "num": 54,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "DJ Wingfield",
    "pos": "G",
    "num": 64,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Dee Winters",
    "pos": "LB",
    "num": 53,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "DJ Withers",
    "pos": "DT",
    "num": 59,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Julius Wood",
    "pos": "SAF",
    "num": 32,
    "status": "Healthy",
    "rating": 78
  },
  {
    "name": "Matt Hennessy",
    "pos": "C",
    "num": 72,
    "status": "Healthy",
    "rating": 80
  }
];
