import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";

/*
 * Perfect Season — the War Room's second game mode, inspired by 82-0.com's
 * 20-0 challenge, rebuilt in depth:
 *
 *   · 12-round draft. Each round spins a TEAM + ERA window and deals that
 *     team-era's player pool with (approximate) real season stat lines. The
 *     dataset spans 47 team-eras across 28 franchises — the '72 Dolphins and
 *     Steel Curtain through the current Chiefs and Lions — and 1,000+ player
 *     seasons.
 *   · Rounds 1-6 draft offense (QB/RB/WR/TE + 2 FLEX), rounds 7-12 draft
 *     defense (EDGE/DT/LB/CB/S + D-FLEX). Premium slots carry multipliers:
 *     QB x1.5, EDGE x1.2, CB x1.2.
 *   · Select a player, then tap a highlighted slot to place them. Sort and
 *     filter the pool; 2 rerolls per draft.
 *   · The Quantum Engine runs a 10,000-run sudden-death Monte Carlo on the
 *     finished roster — run-length distribution, expected run, and the odds
 *     of 20-0 — before the live season plays out one reveal at a time.
 *   · The schedule runs easy→hard (regular season, then 94+ playoff bosses),
 *     which leaves the odds of 20-0 untouched but lets runs build.
 *   · Wins pay Star Coins into the same wallet as the markets, with
 *     milestone bonuses at 5, 10, and 15 wins.
 *
 * Stat lines are approximate historical season numbers — game data, not a
 * record book.
 */

// ── Dataset: team-era pools ─────────────────────────────────────

function P(name, pos, year, rating, stats) {
  return { name, pos, year, rating, stats };
}

const OFF_POS = new Set(["QB", "RB", "WR", "TE"]);
const DEF_POS = new Set(["EDGE", "DT", "LB", "CB", "S"]);

const POOLS = [
  {
    team: "DAL",
    era: "2021–2025",
    players: [
      P("Dak Prescott", "QB", 2023, 91, { YDS: 4516, TD: 36, INT: 9, RTG: 105.9 }),
      P("CeeDee Lamb", "WR", 2023, 94, { REC: 135, YDS: 1749, TD: 12 }),
      P("Tony Pollard", "RB", 2022, 86, { RUYDS: 1007, TD: 9, YPC: 5.2, REC: 39 }),
      P("Jake Ferguson", "TE", 2023, 84, { REC: 71, YDS: 761, TD: 5 }),
      P("Brandin Cooks", "WR", 2023, 83, { REC: 54, YDS: 657, TD: 8 }),
      P("Micah Parsons", "EDGE", 2021, 96, { SACKS: 13, TKL: 84, FF: 3 }),
      P("Trevon Diggs", "CB", 2021, 92, { INT: 11, PD: 21, TKL: 52 }),
      P("DaRon Bland", "CB", 2023, 90, { INT: 9, PD: 14, TD: 5 }),
      P("Osa Odighizuwa", "DT", 2023, 85, { SACKS: 2, TKL: 42 }),
      P("Leighton Vander Esch", "LB", 2022, 83, { TKL: 90, SACKS: 1 }),
      P("Malik Hooker", "S", 2022, 83, { INT: 3, TKL: 61 }),
      P("Ezekiel Elliott", "RB", 2021, 85, { RUYDS: 1002, TD: 10, YPC: 4.2 }),
      P("Dalton Schultz", "TE", 2021, 85, { REC: 78, YDS: 808, TD: 8 }),
      P("Michael Gallup", "WR", 2021, 80, { REC: 35, YDS: 445, TD: 2 }),
      P("Sam Williams", "EDGE", 2023, 80, { SACKS: 4.5, TKL: 25 }),
      P("Jourdan Lewis", "CB", 2023, 82, { INT: 2, PD: 8, TKL: 64 }),
      P("Donovan Wilson", "S", 2022, 84, { TKL: 101, SACKS: 5, INT: 1 }),
      P("DeMarvion Overshown", "LB", 2024, 84, { TKL: 90, SACKS: 5 }),
      P("Rico Dowdle", "RB", 2024, 82, { RUYDS: 1079, TD: 2, YPC: 4.6 }),
      P("KaVontae Turpin", "WR", 2024, 78, { REC: 31, YDS: 420, TD: 2 }),
      P("Dorance Armstrong", "EDGE", 2023, 82, { SACKS: 5.5, TKL: 33 }),
      P("Jayron Kearse", "S", 2021, 83, { TKL: 101, INT: 2 })
    ]
  },
  {
    team: "DAL",
    era: "2016–2020",
    players: [
      P("Dak Prescott", "QB", 2016, 89, { YDS: 3667, TD: 23, INT: 4, RTG: 104.9 }),
      P("Ezekiel Elliott", "RB", 2016, 94, { RUYDS: 1631, TD: 15, YPC: 5.1 }),
      P("Amari Cooper", "WR", 2019, 88, { REC: 79, YDS: 1189, TD: 8 }),
      P("Michael Gallup", "WR", 2019, 84, { REC: 66, YDS: 1107, TD: 6 }),
      P("Jason Witten", "TE", 2017, 85, { REC: 63, YDS: 560, TD: 5 }),
      P("DeMarcus Lawrence", "EDGE", 2017, 91, { SACKS: 14.5, TKL: 58, FF: 4 }),
      P("Maliek Collins", "DT", 2018, 82, { SACKS: 3, TKL: 25 }),
      P("Jaylon Smith", "LB", 2019, 84, { TKL: 142, SACKS: 2.5 }),
      P("Sean Lee", "LB", 2016, 89, { TKL: 145, INT: 1 }),
      P("Byron Jones", "CB", 2018, 87, { PD: 14, TKL: 67 }),
      P("Xavier Woods", "S", 2018, 82, { INT: 2, TKL: 56 }),
      P("Cole Beasley", "WR", 2016, 82, { REC: 75, YDS: 833, TD: 5 }),
      P("Blake Jarwin", "TE", 2019, 78, { REC: 31, YDS: 365, TD: 3 }),
      P("Tony Pollard", "RB", 2019, 79, { RUYDS: 455, TD: 2, YPC: 5.3 }),
      P("Randy Gregory", "EDGE", 2018, 80, { SACKS: 6, TKL: 25 }),
      P("Antwaun Woods", "DT", 2018, 78, { TKL: 35, SACKS: 1 }),
      P("Leighton Vander Esch", "LB", 2018, 87, { TKL: 140, INT: 2 }),
      P("Chidobe Awuzie", "CB", 2019, 82, { PD: 10, TKL: 79 }),
      P("Jeff Heath", "S", 2017, 79, { INT: 3, TKL: 66 }),
      P("Dez Bryant", "WR", 2016, 87, { REC: 50, YDS: 796, TD: 8 }),
      P("CeeDee Lamb", "WR", 2020, 86, { REC: 74, YDS: 935, TD: 5 }),
      P("Aldon Smith", "EDGE", 2020, 81, { SACKS: 5, TKL: 48 }),
      P("Anthony Brown", "CB", 2016, 78, { INT: 1, PD: 12 })
    ]
  },
  {
    team: "DAL",
    era: "1991–1995",
    players: [
      P("Troy Aikman", "QB", 1992, 93, { YDS: 3445, TD: 23, INT: 14, RTG: 89.5 }),
      P("Emmitt Smith", "RB", 1995, 98, { RUYDS: 1773, TD: 25, YPC: 4.7 }),
      P("Michael Irvin", "WR", 1995, 95, { REC: 111, YDS: 1603, TD: 10 }),
      P("Alvin Harper", "WR", 1994, 84, { REC: 33, YDS: 821, TD: 8 }),
      P("Jay Novacek", "TE", 1992, 87, { REC: 68, YDS: 630, TD: 6 }),
      P("Charles Haley", "EDGE", 1994, 93, { SACKS: 12.5, TKL: 58 }),
      P("Leon Lett", "DT", 1994, 87, { SACKS: 5, TKL: 44 }),
      P("Ken Norton Jr.", "LB", 1993, 89, { TKL: 159, SACKS: 2 }),
      P("Darrin Smith", "LB", 1994, 83, { TKL: 96, SACKS: 3 }),
      P("Deion Sanders", "CB", 1995, 98, { INT: 2, PD: 12, TD: 1 }),
      P("Darren Woodson", "S", 1994, 93, { TKL: 121, INT: 5 }),
      P("Daryl Johnston", "RB", 1993, 82, { RUYDS: 74, REC: 50, RECYDS: 372 }),
      P("Kevin Williams", "WR", 1993, 79, { REC: 20, YDS: 151, TD: 2 }),
      P("Tony Tolbert", "EDGE", 1992, 84, { SACKS: 8.5, TKL: 60 }),
      P("Jim Jeffcoat", "EDGE", 1991, 84, { SACKS: 10.5, TKL: 43 }),
      P("Russell Maryland", "DT", 1992, 85, { SACKS: 4.5, TKL: 51 }),
      P("Robert Jones", "LB", 1992, 82, { TKL: 107 }),
      P("Larry Brown", "CB", 1995, 85, { INT: 6, PD: 12 }),
      P("James Washington", "S", 1994, 83, { TKL: 90, INT: 2 }),
      P("Kevin Smith", "CB", 1993, 82, { INT: 3, PD: 12 }),
      P("Chad Hennings", "DT", 1995, 81, { SACKS: 3.5, TKL: 30 }),
      P("Dixon Edwards", "LB", 1994, 79, { TKL: 74 })
    ]
  },
  {
    team: "PHI",
    era: "2021–2025",
    players: [
      P("Jalen Hurts", "QB", 2022, 92, { YDS: 3701, TD: 22, INT: 6, RTG: 101.5, RUYDS: 760 }),
      P("Saquon Barkley", "RB", 2024, 97, { RUYDS: 2005, TD: 13, YPC: 5.8 }),
      P("A.J. Brown", "WR", 2022, 93, { REC: 88, YDS: 1496, TD: 11 }),
      P("DeVonta Smith", "WR", 2022, 88, { REC: 95, YDS: 1196, TD: 7 }),
      P("Dallas Goedert", "TE", 2022, 86, { REC: 55, YDS: 702, TD: 3 }),
      P("D'Andre Swift", "RB", 2023, 84, { RUYDS: 1049, TD: 5, YPC: 4.6 }),
      P("Haason Reddick", "EDGE", 2022, 92, { SACKS: 16, TKL: 49, FF: 5 }),
      P("Fletcher Cox", "DT", 2021, 88, { SACKS: 3.5, TKL: 35 }),
      P("T.J. Edwards", "LB", 2022, 85, { TKL: 159, SACKS: 2 }),
      P("Darius Slay", "CB", 2021, 89, { INT: 3, PD: 13, TD: 2 }),
      P("C.J. Gardner-Johnson", "S", 2022, 86, { INT: 6, TKL: 67 }),
      P("Miles Sanders", "RB", 2022, 86, { RUYDS: 1269, TD: 11, YPC: 4.9 }),
      P("Kenneth Gainwell", "RB", 2023, 79, { RUYDS: 364, TD: 2, REC: 30, RECYDS: 183 }),
      P("Quez Watkins", "WR", 2021, 78, { REC: 43, YDS: 647, TD: 1 }),
      P("Zach Ertz", "TE", 2021, 84, { REC: 74, YDS: 763, TD: 5 }),
      P("Josh Sweat", "EDGE", 2022, 87, { SACKS: 11, TKL: 48 }),
      P("Jalen Carter", "DT", 2023, 88, { SACKS: 6, TKL: 33 }),
      P("Jordan Davis", "DT", 2023, 83, { TKL: 39, SACKS: 2 }),
      P("Zack Baun", "LB", 2024, 91, { TKL: 151, INT: 1, FF: 5 }),
      P("James Bradberry", "CB", 2022, 87, { INT: 3, PD: 17 }),
      P("Reed Blankenship", "S", 2023, 82, { INT: 3, TKL: 106 }),
      P("Quinyon Mitchell", "CB", 2024, 85, { PD: 12, TKL: 58 }),
      P("Cooper DeJean", "CB", 2024, 83, { INT: 1, PD: 8, TD: 1 }),
      P("Nolan Smith", "EDGE", 2024, 82, { SACKS: 6.5, TKL: 40 }),
      P("Milton Williams", "DT", 2024, 82, { SACKS: 5, TKL: 30 })
    ]
  },
  {
    team: "PHI",
    era: "2001–2005",
    players: [
      P("Donovan McNabb", "QB", 2004, 91, { YDS: 3875, TD: 31, INT: 8, RTG: 104.7 }),
      P("Brian Westbrook", "RB", 2004, 88, { RUYDS: 812, TD: 9, REC: 73, RECYDS: 703 }),
      P("Terrell Owens", "WR", 2004, 95, { REC: 77, YDS: 1200, TD: 14 }),
      P("Todd Pinkston", "WR", 2004, 79, { REC: 36, YDS: 676, TD: 1 }),
      P("Chad Lewis", "TE", 2004, 80, { REC: 29, YDS: 267, TD: 3 }),
      P("Jevon Kearse", "EDGE", 2004, 87, { SACKS: 7.5, TKL: 39 }),
      P("Corey Simon", "DT", 2003, 84, { SACKS: 7.5, TKL: 45 }),
      P("Jeremiah Trotter", "LB", 2004, 87, { TKL: 89, SACKS: 1 }),
      P("Lito Sheppard", "CB", 2004, 86, { INT: 5, PD: 14, TD: 2 }),
      P("Brian Dawkins", "S", 2004, 94, { INT: 4, TKL: 78, FF: 3 }),
      P("Duce Staley", "RB", 2002, 83, { RUYDS: 1029, TD: 5, REC: 51 }),
      P("Correll Buckhalter", "RB", 2003, 79, { RUYDS: 542, TD: 8 }),
      P("Freddie Mitchell", "WR", 2004, 77, { REC: 22, YDS: 377, TD: 2 }),
      P("L.J. Smith", "TE", 2004, 79, { REC: 34, YDS: 377, TD: 5 }),
      P("Hugh Douglas", "EDGE", 2002, 87, { SACKS: 12.5, TKL: 52 }),
      P("Darwin Walker", "DT", 2002, 81, { SACKS: 7.5, TKL: 40 }),
      P("Dhani Jones", "LB", 2004, 79, { TKL: 89 }),
      P("Sheldon Brown", "CB", 2004, 82, { INT: 2, PD: 15 }),
      P("Michael Lewis", "S", 2004, 83, { TKL: 88, INT: 1 }),
      P("Troy Vincent", "CB", 2002, 86, { INT: 5, PD: 14 }),
      P("Bobby Taylor", "CB", 2002, 84, { INT: 3, PD: 12 }),
      P("N.D. Kalu", "EDGE", 2003, 78, { SACKS: 5, TKL: 28 }),
      P("James Thrash", "WR", 2001, 78, { REC: 63, YDS: 833, TD: 8 })
    ]
  },
  {
    team: "ARI",
    era: "2016–2020",
    players: [
      P("Kyler Murray", "QB", 2020, 88, { YDS: 3971, TD: 26, INT: 12, RUYDS: 819 }),
      P("David Johnson", "RB", 2016, 93, { RUYDS: 1239, TD: 16, REC: 80, RECYDS: 879 }),
      P("Kenyan Drake", "RB", 2019, 84, { RUYDS: 817, TD: 8, YPC: 4.8, REC: 50 }),
      P("Larry Fitzgerald", "WR", 2016, 90, { REC: 107, YDS: 1023, TD: 6 }),
      P("DeAndre Hopkins", "WR", 2020, 93, { REC: 115, YDS: 1407, TD: 6 }),
      P("Ricky Seals-Jones", "TE", 2018, 78, { REC: 34, YDS: 343, TD: 1 }),
      P("Chandler Jones", "EDGE", 2017, 94, { SACKS: 17, TKL: 61, FF: 2 }),
      P("Calais Campbell", "DT", 2016, 91, { SACKS: 8, TKL: 53 }),
      P("Deone Bucannon", "LB", 2016, 83, { TKL: 89, SACKS: 2 }),
      P("Patrick Peterson", "CB", 2016, 93, { INT: 3, PD: 12 }),
      P("Budda Baker", "S", 2019, 89, { TKL: 147, PD: 6 }),
      P("Christian Kirk", "WR", 2019, 80, { REC: 68, YDS: 709, TD: 3 }),
      P("Chase Edmonds", "RB", 2020, 81, { RUYDS: 448, TD: 1, REC: 53, RECYDS: 402 }),
      P("Dan Arnold", "TE", 2020, 78, { REC: 31, YDS: 438, TD: 4 }),
      P("Markus Golden", "EDGE", 2016, 86, { SACKS: 12.5, TKL: 51 }),
      P("Corey Peters", "DT", 2018, 80, { TKL: 46, SACKS: 1.5 }),
      P("Haason Reddick", "LB", 2020, 87, { SACKS: 12.5, TKL: 61 }),
      P("Jordan Hicks", "LB", 2019, 85, { TKL: 150, SACKS: 3 }),
      P("Byron Murphy", "CB", 2020, 81, { PD: 11, TKL: 78 }),
      P("Tyrann Mathieu", "S", 2016, 87, { INT: 1, TKL: 68 }),
      P("Carson Palmer", "QB", 2016, 85, { YDS: 4233, TD: 26, INT: 14 }),
      P("J.J. Watt", "EDGE", 2020, 85, { SACKS: 5, TKL: 52 }),
      P("Isaiah Simmons", "LB", 2020, 79, { TKL: 55, SACKS: 1 }),
      P("Jordan Phillips", "DT", 2020, 78, { TKL: 32, SACKS: 3 })
    ]
  },
  {
    team: "KC",
    era: "2018–2022",
    players: [
      P("Patrick Mahomes", "QB", 2018, 99, { YDS: 5097, TD: 50, INT: 12, RTG: 113.8 }),
      P("Travis Kelce", "TE", 2022, 97, { REC: 110, YDS: 1338, TD: 12 }),
      P("Tyreek Hill", "WR", 2020, 94, { REC: 87, YDS: 1276, TD: 15 }),
      P("JuJu Smith-Schuster", "WR", 2022, 82, { REC: 78, YDS: 933, TD: 3 }),
      P("Clyde Edwards-Helaire", "RB", 2020, 80, { RUYDS: 803, TD: 4, YPC: 4.4 }),
      P("Jerick McKinnon", "RB", 2022, 79, { RUYDS: 291, TD: 1, REC: 56, RECTD: 9 }),
      P("Chris Jones", "DT", 2022, 95, { SACKS: 15.5, TKL: 44 }),
      P("Frank Clark", "EDGE", 2019, 85, { SACKS: 8, TKL: 37 }),
      P("Nick Bolton", "LB", 2022, 86, { TKL: 180, SACKS: 2 }),
      P("L'Jarius Sneed", "CB", 2022, 87, { INT: 3, PD: 11, SACKS: 3.5 }),
      P("Tyrann Mathieu", "S", 2020, 90, { INT: 6, TKL: 62 }),
      P("Kareem Hunt", "RB", 2018, 86, { RUYDS: 824, TD: 14, YPC: 4.6 }),
      P("Damien Williams", "RB", 2019, 80, { RUYDS: 498, TD: 7, REC: 30 }),
      P("Sammy Watkins", "WR", 2019, 81, { REC: 52, YDS: 673, TD: 3 }),
      P("Mecole Hardman", "WR", 2019, 81, { REC: 26, YDS: 538, TD: 6 }),
      P("Blake Bell", "TE", 2019, 76, { REC: 8, YDS: 67, TD: 0 }),
      P("Melvin Ingram", "EDGE", 2021, 81, { SACKS: 1, TKL: 24 }),
      P("Tershawn Wharton", "DT", 2021, 78, { SACKS: 2, TKL: 27 }),
      P("Willie Gay", "LB", 2021, 81, { TKL: 48, INT: 1 }),
      P("Charvarius Ward", "CB", 2021, 84, { PD: 10, TKL: 67 }),
      P("Juan Thornhill", "S", 2019, 82, { INT: 3, TKL: 58 }),
      P("Isiah Pacheco", "RB", 2022, 81, { RUYDS: 830, TD: 5, YPC: 4.9 }),
      P("Marquez Valdes-Scantling", "WR", 2022, 78, { REC: 42, YDS: 687, TD: 2 }),
      P("George Karlaftis", "EDGE", 2022, 81, { SACKS: 6, TKL: 30 }),
      P("Justin Reid", "S", 2022, 82, { TKL: 87, INT: 1 })
    ]
  },
  {
    team: "NE",
    era: "2007–2011",
    players: [
      P("Tom Brady", "QB", 2007, 99, { YDS: 4806, TD: 50, INT: 8, RTG: 117.2 }),
      P("Randy Moss", "WR", 2007, 98, { REC: 98, YDS: 1493, TD: 23 }),
      P("Wes Welker", "WR", 2009, 90, { REC: 123, YDS: 1348, TD: 4 }),
      P("Rob Gronkowski", "TE", 2011, 96, { REC: 90, YDS: 1327, TD: 17 }),
      P("BenJarvus Green-Ellis", "RB", 2010, 81, { RUYDS: 1008, TD: 13, YPC: 4.4 }),
      P("Kevin Faulk", "RB", 2008, 79, { RUYDS: 507, REC: 58, TD: 6 }),
      P("Vince Wilfork", "DT", 2010, 91, { TKL: 57, SACKS: 2 }),
      P("Mike Vrabel", "EDGE", 2007, 88, { SACKS: 12.5, TKL: 76 }),
      P("Jerod Mayo", "LB", 2010, 87, { TKL: 175, SACKS: 2 }),
      P("Asante Samuel", "CB", 2007, 89, { INT: 6, PD: 17 }),
      P("Brandon Meriweather", "S", 2009, 82, { INT: 5, TKL: 66 }),
      P("Laurence Maroney", "RB", 2007, 79, { RUYDS: 835, TD: 6, YPC: 4.5 }),
      P("Donte Stallworth", "WR", 2007, 81, { REC: 46, YDS: 697, TD: 3 }),
      P("Aaron Hernandez", "TE", 2011, 87, { REC: 79, YDS: 910, TD: 7 }),
      P("Ty Warren", "DT", 2007, 85, { TKL: 59, SACKS: 4 }),
      P("Richard Seymour", "DT", 2007, 90, { SACKS: 1.5, TKL: 37 }),
      P("Adalius Thomas", "EDGE", 2007, 85, { SACKS: 6.5, TKL: 71 }),
      P("Brandon Spikes", "LB", 2010, 80, { TKL: 62 }),
      P("Devin McCourty", "CB", 2010, 88, { INT: 7, PD: 17 }),
      P("Patrick Chung", "S", 2010, 82, { TKL: 96, INT: 3 }),
      P("Deion Branch", "WR", 2011, 79, { REC: 51, YDS: 702, TD: 5 }),
      P("Danny Woodhead", "RB", 2010, 79, { RUYDS: 547, REC: 34, TD: 6 }),
      P("Tully Banta-Cain", "EDGE", 2009, 80, { SACKS: 10, TKL: 34 }),
      P("Gary Guyton", "LB", 2009, 77, { TKL: 79, INT: 1 })
    ]
  },
  {
    team: "NE",
    era: "2001–2005",
    players: [
      P("Tom Brady", "QB", 2004, 95, { YDS: 3692, TD: 28, INT: 14, RTG: 92.6 }),
      P("Corey Dillon", "RB", 2004, 90, { RUYDS: 1635, TD: 12, YPC: 4.7 }),
      P("Deion Branch", "WR", 2005, 84, { REC: 78, YDS: 998, TD: 5 }),
      P("Troy Brown", "WR", 2001, 87, { REC: 101, YDS: 1199, TD: 5 }),
      P("Daniel Graham", "TE", 2004, 80, { REC: 30, YDS: 364, TD: 7 }),
      P("Willie McGinest", "EDGE", 2005, 87, { SACKS: 9.5, TKL: 48 }),
      P("Richard Seymour", "DT", 2003, 93, { SACKS: 8, TKL: 57 }),
      P("Tedy Bruschi", "LB", 2004, 88, { TKL: 122, INT: 3 }),
      P("Ty Law", "CB", 2003, 92, { INT: 6, PD: 23 }),
      P("Rodney Harrison", "S", 2004, 90, { TKL: 138, INT: 2, SACKS: 3 }),
      P("Antowain Smith", "RB", 2001, 83, { RUYDS: 1157, TD: 12, YPC: 4.0 }),
      P("Kevin Faulk", "RB", 2003, 79, { RUYDS: 638, REC: 48, TD: 1 }),
      P("David Givens", "WR", 2004, 81, { REC: 56, YDS: 874, TD: 3 }),
      P("David Patten", "WR", 2001, 80, { REC: 51, YDS: 749, TD: 4 }),
      P("Christian Fauria", "TE", 2002, 78, { REC: 27, YDS: 253, TD: 7 }),
      P("Jarvis Green", "EDGE", 2003, 79, { SACKS: 2.5, TKL: 21 }),
      P("Mike Vrabel", "LB", 2003, 87, { SACKS: 9.5, TKL: 67, INT: 2 }),
      P("Roman Phifer", "LB", 2001, 80, { TKL: 90 }),
      P("Asante Samuel", "CB", 2004, 84, { INT: 1, PD: 12 }),
      P("Eugene Wilson", "S", 2003, 81, { INT: 4, TKL: 69 }),
      P("Lawyer Milloy", "S", 2001, 85, { TKL: 105, INT: 2 }),
      P("Bobby Hamilton", "DT", 2001, 78, { SACKS: 7, TKL: 38 }),
      P("Anthony Pleasant", "EDGE", 2001, 78, { SACKS: 4.5, TKL: 36 }),
      P("Bethel Johnson", "WR", 2003, 75, { REC: 16, YDS: 209, TD: 2 })
    ]
  },
  {
    team: "SF",
    era: "1984–1989",
    players: [
      P("Joe Montana", "QB", 1989, 97, { YDS: 3521, TD: 26, INT: 8, RTG: 112.4 }),
      P("Jerry Rice", "WR", 1987, 99, { REC: 65, YDS: 1078, TD: 22 }),
      P("Roger Craig", "RB", 1988, 91, { RUYDS: 1502, TD: 9, REC: 76 }),
      P("John Taylor", "WR", 1989, 86, { REC: 60, YDS: 1077, TD: 10 }),
      P("Brent Jones", "TE", 1989, 84, { REC: 40, YDS: 500, TD: 4 }),
      P("Charles Haley", "EDGE", 1989, 91, { SACKS: 10.5, TKL: 51 }),
      P("Michael Carter", "DT", 1987, 86, { SACKS: 5, TKL: 43 }),
      P("Riki Ellison", "LB", 1985, 80, { TKL: 90 }),
      P("Ronnie Lott", "S", 1986, 97, { INT: 10, TKL: 77 }),
      P("Eric Wright", "CB", 1985, 86, { INT: 2, PD: 10 }),
      P("Don Griffin", "CB", 1988, 82, { INT: 1, PD: 12 }),
      P("Wendell Tyler", "RB", 1984, 84, { RUYDS: 1262, TD: 7, YPC: 5.1 }),
      P("Tom Rathman", "RB", 1987, 80, { RUYDS: 257, REC: 30, TD: 4 }),
      P("Mike Wilson", "WR", 1985, 77, { REC: 10, YDS: 165, TD: 2 }),
      P("Russ Francis", "TE", 1984, 81, { REC: 23, YDS: 285, TD: 2 }),
      P("Dwaine Board", "EDGE", 1984, 83, { SACKS: 10, TKL: 45 }),
      P("Jeff Stover", "DT", 1986, 79, { SACKS: 8, TKL: 32 }),
      P("Keena Turner", "LB", 1986, 84, { TKL: 75, INT: 2 }),
      P("Tim McKyer", "CB", 1986, 84, { INT: 6, PD: 14 }),
      P("Carlton Williamson", "S", 1984, 82, { INT: 4, TKL: 60 }),
      P("Fred Dean", "EDGE", 1984, 88, { SACKS: 17.5, TKL: 40 }),
      P("Gary Johnson", "DT", 1984, 82, { SACKS: 10, TKL: 40 }),
      P("Michael Walter", "LB", 1987, 79, { TKL: 90 }),
      P("Jim Fahnhorst", "LB", 1987, 77, { TKL: 65 })
    ]
  },
  {
    team: "SF",
    era: "2019–2023",
    players: [
      P("Brock Purdy", "QB", 2023, 88, { YDS: 4280, TD: 31, INT: 11, RTG: 113.0 }),
      P("Christian McCaffrey", "RB", 2023, 97, { RUYDS: 1459, TD: 21, REC: 67, RECYDS: 564 }),
      P("Deebo Samuel", "WR", 2021, 92, { REC: 77, YDS: 1405, TD: 14, RUYDS: 365 }),
      P("Brandon Aiyuk", "WR", 2023, 88, { REC: 75, YDS: 1342, TD: 7 }),
      P("George Kittle", "TE", 2019, 94, { REC: 85, YDS: 1053, TD: 5 }),
      P("Nick Bosa", "EDGE", 2022, 96, { SACKS: 18.5, TKL: 51 }),
      P("Arik Armstead", "DT", 2019, 87, { SACKS: 10, TKL: 54 }),
      P("Fred Warner", "LB", 2021, 96, { TKL: 137, INT: 2, SACKS: 1 }),
      P("Charvarius Ward", "CB", 2023, 88, { INT: 5, PD: 23 }),
      P("Talanoa Hufanga", "S", 2022, 87, { INT: 4, TKL: 97 }),
      P("Raheem Mostert", "RB", 2019, 84, { RUYDS: 772, TD: 8, YPC: 5.6 }),
      P("Elijah Mitchell", "RB", 2021, 82, { RUYDS: 963, TD: 5, YPC: 4.7 }),
      P("Jauan Jennings", "WR", 2023, 80, { REC: 19, YDS: 265, TD: 1 }),
      P("Ross Dwelley", "TE", 2021, 76, { REC: 5, YDS: 26, TD: 1 }),
      P("Javon Hargrave", "DT", 2023, 86, { SACKS: 7, TKL: 32 }),
      P("Samson Ebukam", "EDGE", 2022, 81, { SACKS: 5, TKL: 44 }),
      P("Dre Greenlaw", "LB", 2022, 86, { TKL: 127, INT: 2 }),
      P("Emmanuel Moseley", "CB", 2021, 82, { PD: 8, TKL: 47 }),
      P("Deommodore Lenoir", "CB", 2023, 82, { INT: 1, PD: 10, TKL: 84 }),
      P("Jimmie Ward", "S", 2021, 84, { INT: 2, TKL: 68 }),
      P("Jimmy Garoppolo", "QB", 2019, 84, { YDS: 3978, TD: 27, INT: 13, RTG: 102.0 }),
      P("DeForest Buckner", "DT", 2019, 89, { SACKS: 7.5, TKL: 62 }),
      P("Chase Young", "EDGE", 2023, 81, { SACKS: 7.5, TKL: 34 }),
      P("Azeez Al-Shaair", "LB", 2021, 80, { TKL: 100, SACKS: 1 })
    ]
  },
  {
    team: "CHI",
    era: "1984–1988",
    players: [
      P("Jim McMahon", "QB", 1985, 83, { YDS: 2392, TD: 15, INT: 11 }),
      P("Walter Payton", "RB", 1985, 97, { RUYDS: 1551, TD: 9, YPC: 4.8 }),
      P("Willie Gault", "WR", 1985, 85, { REC: 33, YDS: 704, TD: 1 }),
      P("Dennis McKinnon", "WR", 1985, 80, { REC: 31, YDS: 555, TD: 7 }),
      P("Emery Moorehead", "TE", 1985, 79, { REC: 35, YDS: 481, TD: 1 }),
      P("Richard Dent", "EDGE", 1985, 94, { SACKS: 17, TKL: 54, FF: 7 }),
      P("Dan Hampton", "DT", 1985, 92, { SACKS: 6.5, TKL: 57 }),
      P("Steve McMichael", "DT", 1985, 89, { SACKS: 8, TKL: 51 }),
      P("Mike Singletary", "LB", 1985, 96, { TKL: 113, INT: 1 }),
      P("Wilber Marshall", "LB", 1986, 89, { TKL: 117, SACKS: 5.5, INT: 5 }),
      P("Gary Fencik", "S", 1985, 86, { INT: 5, TKL: 87 }),
      P("Neal Anderson", "RB", 1988, 85, { RUYDS: 1106, TD: 12, YPC: 4.3 }),
      P("Matt Suhey", "RB", 1985, 78, { RUYDS: 471, REC: 33, TD: 1 }),
      P("Dennis Gentry", "WR", 1986, 76, { REC: 19, YDS: 238, TD: 1 }),
      P("Tim Wrightman", "TE", 1985, 76, { REC: 24, YDS: 407, TD: 1 }),
      P("William Perry", "DT", 1985, 82, { SACKS: 5, TKL: 51, TD: 2 }),
      P("Mike Hartenstine", "EDGE", 1985, 79, { SACKS: 5.5, TKL: 38 }),
      P("Ron Rivera", "LB", 1986, 78, { TKL: 44 }),
      P("Mike Richardson", "CB", 1986, 81, { INT: 7, PD: 12 }),
      P("Todd Bell", "S", 1984, 83, { INT: 4, TKL: 86 }),
      P("Otis Wilson", "LB", 1985, 87, { TKL: 87, SACKS: 10.5, INT: 3 }),
      P("Dave Duerson", "S", 1986, 84, { INT: 6, TKL: 70 }),
      P("Leslie Frazier", "CB", 1985, 82, { INT: 6, PD: 11 }),
      P("Vestee Jackson", "CB", 1988, 78, { INT: 5, PD: 10 })
    ]
  },
  {
    team: "PIT",
    era: "1972–1979",
    players: [
      P("Terry Bradshaw", "QB", 1978, 88, { YDS: 2915, TD: 28, INT: 20 }),
      P("Franco Harris", "RB", 1975, 90, { RUYDS: 1246, TD: 10, YPC: 4.8 }),
      P("Lynn Swann", "WR", 1975, 88, { REC: 49, YDS: 781, TD: 11 }),
      P("John Stallworth", "WR", 1979, 89, { REC: 70, YDS: 1183, TD: 8 }),
      P("Bennie Cunningham", "TE", 1978, 79, { REC: 16, YDS: 321, TD: 2 }),
      P("L.C. Greenwood", "EDGE", 1974, 90, { SACKS: 11, TKL: 48 }),
      P("Joe Greene", "DT", 1972, 97, { SACKS: 11, TKL: 60 }),
      P("Jack Lambert", "LB", 1976, 96, { TKL: 130, INT: 2 }),
      P("Jack Ham", "LB", 1975, 94, { TKL: 98, INT: 3 }),
      P("Mel Blount", "CB", 1975, 95, { INT: 11, PD: 15 }),
      P("Donnie Shell", "S", 1979, 88, { INT: 5, TKL: 80 }),
      P("Rocky Bleier", "RB", 1976, 82, { RUYDS: 1036, TD: 5, YPC: 4.7 }),
      P("Frank Lewis", "WR", 1973, 78, { REC: 28, YDS: 409, TD: 4 }),
      P("Randy Grossman", "TE", 1978, 76, { REC: 37, YDS: 448, TD: 1 }),
      P("Dwight White", "EDGE", 1972, 86, { SACKS: 10, TKL: 52 }),
      P("Ernie Holmes", "DT", 1974, 87, { SACKS: 8, TKL: 55 }),
      P("Andy Russell", "LB", 1974, 87, { TKL: 90, INT: 2 }),
      P("J.T. Thomas", "CB", 1975, 79, { INT: 3, PD: 10 }),
      P("Mike Wagner", "S", 1973, 85, { INT: 8, TKL: 60 }),
      P("Glen Edwards", "S", 1974, 82, { INT: 5, TKL: 55 }),
      P("Steve Furness", "DT", 1976, 80, { SACKS: 6, TKL: 40 }),
      P("Loren Toews", "LB", 1978, 77, { TKL: 70 }),
      P("Ron Johnson", "CB", 1978, 77, { INT: 3, PD: 9 }),
      P("Theo Bell", "WR", 1979, 75, { REC: 21, YDS: 296, TD: 1 })
    ]
  },
  {
    team: "BAL",
    era: "2000–2004",
    players: [
      P("Trent Dilfer", "QB", 2000, 76, { YDS: 1502, TD: 12, INT: 11 }),
      P("Jamal Lewis", "RB", 2003, 94, { RUYDS: 2066, TD: 14, YPC: 5.3 }),
      P("Travis Taylor", "WR", 2002, 78, { REC: 61, YDS: 869, TD: 6 }),
      P("Shannon Sharpe", "TE", 2000, 89, { REC: 67, YDS: 810, TD: 5 }),
      P("Todd Heap", "TE", 2002, 84, { REC: 68, YDS: 836, TD: 6 }),
      P("Peter Boulware", "EDGE", 2001, 89, { SACKS: 15, TKL: 44 }),
      P("Sam Adams", "DT", 2000, 87, { SACKS: 3, TKL: 41 }),
      P("Ray Lewis", "LB", 2000, 99, { TKL: 137, INT: 2, SACKS: 3 }),
      P("Chris McAlister", "CB", 2003, 89, { INT: 3, PD: 15 }),
      P("Ed Reed", "S", 2004, 96, { INT: 9, PD: 17, TD: 1 }),
      P("Rod Woodson", "S", 2001, 91, { INT: 4, TKL: 82 }),
      P("Chester Taylor", "RB", 2003, 78, { RUYDS: 276, TD: 1, YPC: 4.6 }),
      P("Priest Holmes", "RB", 2000, 80, { RUYDS: 588, YPC: 4.3, REC: 32 }),
      P("Brandon Stokley", "WR", 2000, 78, { REC: 11, YDS: 184, TD: 2 }),
      P("Michael McCrary", "EDGE", 2000, 83, { SACKS: 6.5, TKL: 44 }),
      P("Kelly Gregg", "DT", 2002, 82, { TKL: 71, SACKS: 2 }),
      P("Jamie Sharper", "LB", 2000, 84, { TKL: 111, SACKS: 3 }),
      P("Adalius Thomas", "LB", 2003, 84, { SACKS: 8, TKL: 57 }),
      P("Duane Starks", "CB", 2000, 83, { INT: 6, PD: 14 }),
      P("Gary Baxter", "CB", 2003, 80, { PD: 12, TKL: 63 }),
      P("Terrell Suggs", "EDGE", 2003, 87, { SACKS: 12, TKL: 32, FF: 3 }),
      P("Ed Hartwell", "LB", 2002, 80, { TKL: 111, SACKS: 2 }),
      P("Anthony Weaver", "DT", 2003, 78, { SACKS: 4, TKL: 40 }),
      P("Kyle Boller", "QB", 2004, 72, { YDS: 2559, TD: 13, INT: 11 })
    ]
  },
  {
    team: "STL",
    era: "1999–2003",
    players: [
      P("Kurt Warner", "QB", 2001, 95, { YDS: 4830, TD: 36, INT: 22, RTG: 101.4 }),
      P("Marshall Faulk", "RB", 2000, 97, { RUYDS: 1359, TD: 26, REC: 81, RECYDS: 830 }),
      P("Isaac Bruce", "WR", 1999, 91, { REC: 77, YDS: 1165, TD: 12 }),
      P("Torry Holt", "WR", 2003, 93, { REC: 117, YDS: 1696, TD: 12 }),
      P("Ernie Conwell", "TE", 2000, 78, { REC: 34, YDS: 431, TD: 3 }),
      P("Grant Wistrom", "EDGE", 2001, 84, { SACKS: 9, TKL: 51 }),
      P("D'Marco Farr", "DT", 1999, 82, { SACKS: 8.5, TKL: 39 }),
      P("London Fletcher", "LB", 2001, 88, { TKL: 145, SACKS: 2.5 }),
      P("Aeneas Williams", "CB", 2001, 91, { INT: 4, PD: 14, TD: 2 }),
      P("Adam Archuleta", "S", 2002, 80, { TKL: 95, SACKS: 3 }),
      P("Trung Canidate", "RB", 2001, 77, { RUYDS: 441, TD: 2, YPC: 5.7 }),
      P("Az-Zahir Hakim", "WR", 1999, 81, { REC: 36, YDS: 677, TD: 8 }),
      P("Ricky Proehl", "WR", 2001, 79, { REC: 40, YDS: 563, TD: 5 }),
      P("Jeff Robinson", "TE", 2000, 76, { REC: 16, YDS: 220, TD: 4 }),
      P("Leonard Little", "EDGE", 2001, 88, { SACKS: 14.5, TKL: 42 }),
      P("Ryan Pickett", "DT", 2002, 79, { TKL: 46, SACKS: 1 }),
      P("Mike Jones", "LB", 1999, 83, { TKL: 96, INT: 4 }),
      P("Tommy Polley", "LB", 2001, 78, { TKL: 88, INT: 2 }),
      P("Dexter McCleon", "CB", 1999, 79, { INT: 4, PD: 13 }),
      P("Kim Herring", "S", 2001, 78, { INT: 3, TKL: 60 }),
      P("Kevin Carter", "EDGE", 1999, 90, { SACKS: 17, TKL: 55 }),
      P("Marc Bulger", "QB", 2003, 84, { YDS: 3845, TD: 22, INT: 22 }),
      P("Todd Lyght", "CB", 1999, 82, { INT: 6, PD: 12 }),
      P("Roland Williams", "TE", 1999, 76, { REC: 24, YDS: 226, TD: 3 })
    ]
  },
  {
    team: "IND",
    era: "2003–2007",
    players: [
      P("Peyton Manning", "QB", 2004, 99, { YDS: 4557, TD: 49, INT: 10, RTG: 121.1 }),
      P("Edgerrin James", "RB", 2004, 91, { RUYDS: 1548, TD: 9, YPC: 4.6 }),
      P("Marvin Harrison", "WR", 2002, 97, { REC: 143, YDS: 1722, TD: 11 }),
      P("Reggie Wayne", "WR", 2007, 92, { REC: 104, YDS: 1510, TD: 10 }),
      P("Dallas Clark", "TE", 2007, 86, { REC: 58, YDS: 616, TD: 11 }),
      P("Dwight Freeney", "EDGE", 2004, 93, { SACKS: 16, TKL: 39, FF: 4 }),
      P("Robert Mathis", "EDGE", 2005, 89, { SACKS: 11.5, TKL: 41, FF: 6 }),
      P("Booger McFarland", "DT", 2006, 81, { SACKS: 2, TKL: 30 }),
      P("Cato June", "LB", 2005, 83, { TKL: 111, INT: 5 }),
      P("Nick Harper", "CB", 2005, 80, { INT: 2, PD: 11 }),
      P("Bob Sanders", "S", 2005, 92, { TKL: 118, INT: 1 }),
      P("Joseph Addai", "RB", 2006, 85, { RUYDS: 1081, TD: 7, YPC: 4.8 }),
      P("Dominic Rhodes", "RB", 2006, 79, { RUYDS: 641, TD: 5, YPC: 3.4 }),
      P("Brandon Stokley", "WR", 2004, 85, { REC: 68, YDS: 1077, TD: 10 }),
      P("Ben Utecht", "TE", 2006, 76, { REC: 37, YDS: 377, TD: 0 }),
      P("Raheem Brock", "DT", 2005, 80, { SACKS: 6, TKL: 42 }),
      P("Montae Reagor", "DT", 2004, 78, { SACKS: 4.5, TKL: 33 }),
      P("David Thornton", "LB", 2005, 80, { TKL: 106, SACKS: 2 }),
      P("Jason David", "CB", 2005, 78, { INT: 4, PD: 12 }),
      P("Antoine Bethea", "S", 2007, 84, { TKL: 96, INT: 4 }),
      P("Mike Doss", "S", 2004, 78, { TKL: 71, INT: 2 }),
      P("Gary Brackett", "LB", 2006, 82, { TKL: 127, INT: 1 }),
      P("Marlin Jackson", "CB", 2006, 79, { INT: 3, PD: 10 }),
      P("Corey Simon", "DT", 2005, 80, { SACKS: 2, TKL: 24 }),
      P("Anthony Gonzalez", "WR", 2007, 79, { REC: 37, YDS: 576, TD: 3 })
    ]
  },
  {
    team: "SEA",
    era: "2012–2016",
    players: [
      P("Russell Wilson", "QB", 2015, 92, { YDS: 4024, TD: 34, INT: 8, RTG: 110.1 }),
      P("Marshawn Lynch", "RB", 2012, 93, { RUYDS: 1590, TD: 11, YPC: 5.0 }),
      P("Doug Baldwin", "WR", 2015, 88, { REC: 78, YDS: 1069, TD: 14 }),
      P("Tyler Lockett", "WR", 2016, 84, { REC: 41, YDS: 597, TD: 1 }),
      P("Jimmy Graham", "TE", 2016, 85, { REC: 65, YDS: 923, TD: 6 }),
      P("Cliff Avril", "EDGE", 2016, 87, { SACKS: 11.5, TKL: 38, FF: 3 }),
      P("Michael Bennett", "DT", 2015, 89, { SACKS: 10, TKL: 52 }),
      P("Bobby Wagner", "LB", 2014, 96, { TKL: 104, SACKS: 2 }),
      P("Richard Sherman", "CB", 2013, 96, { INT: 8, PD: 16 }),
      P("Earl Thomas", "S", 2013, 96, { INT: 5, TKL: 105 }),
      P("Kam Chancellor", "S", 2014, 92, { TKL: 81, INT: 1, FF: 2 }),
      P("Thomas Rawls", "RB", 2015, 81, { RUYDS: 830, TD: 4, YPC: 5.6 }),
      P("Christine Michael", "RB", 2016, 76, { RUYDS: 469, TD: 6, YPC: 3.9 }),
      P("Golden Tate", "WR", 2013, 83, { REC: 64, YDS: 898, TD: 5 }),
      P("Percy Harvin", "WR", 2014, 78, { REC: 22, YDS: 133, TD: 0 }),
      P("Luke Willson", "TE", 2014, 77, { REC: 22, YDS: 362, TD: 3 }),
      P("Bruce Irvin", "EDGE", 2012, 82, { SACKS: 8, TKL: 22 }),
      P("Frank Clark", "EDGE", 2016, 84, { SACKS: 10, TKL: 47 }),
      P("Brandon Mebane", "DT", 2013, 83, { TKL: 42, SACKS: 0.5 }),
      P("K.J. Wright", "LB", 2016, 86, { TKL: 126, SACKS: 2 }),
      P("Malcolm Smith", "LB", 2013, 79, { TKL: 46, INT: 2, TD: 1 }),
      P("Byron Maxwell", "CB", 2014, 81, { INT: 2, PD: 12 }),
      P("Chris Clemons", "EDGE", 2012, 84, { SACKS: 11.5, TKL: 40 }),
      P("Jermaine Kearse", "WR", 2015, 78, { REC: 49, YDS: 685, TD: 5 }),
      P("DeShawn Shead", "CB", 2016, 78, { PD: 9, TKL: 76 }),
      P("Jarran Reed", "DT", 2016, 78, { TKL: 32, SACKS: 1.5 })
    ]
  },
  {
    team: "GB",
    era: "1994–1998",
    players: [
      P("Brett Favre", "QB", 1996, 95, { YDS: 3899, TD: 39, INT: 13, RTG: 95.8 }),
      P("Dorsey Levens", "RB", 1997, 86, { RUYDS: 1435, TD: 7, YPC: 4.4 }),
      P("Edgar Bennett", "RB", 1995, 81, { RUYDS: 1067, TD: 3, YPC: 3.4 }),
      P("Antonio Freeman", "WR", 1998, 89, { REC: 84, YDS: 1424, TD: 14 }),
      P("Robert Brooks", "WR", 1995, 85, { REC: 102, YDS: 1497, TD: 13 }),
      P("Mark Chmura", "TE", 1995, 84, { REC: 54, YDS: 679, TD: 7 }),
      P("Reggie White", "EDGE", 1998, 98, { SACKS: 16, TKL: 47, FF: 2 }),
      P("Santana Dotson", "DT", 1996, 84, { SACKS: 5.5, TKL: 41 }),
      P("Wayne Simmons", "LB", 1996, 82, { TKL: 76, SACKS: 3 }),
      P("Craig Newsome", "CB", 1996, 81, { INT: 2, PD: 14 }),
      P("LeRoy Butler", "S", 1996, 92, { INT: 5, TKL: 90, SACKS: 6.5 }),
      P("William Henderson", "RB", 1997, 78, { RUYDS: 113, REC: 41, TD: 1 }),
      P("Don Beebe", "WR", 1996, 79, { REC: 39, YDS: 699, TD: 4 }),
      P("Derrick Mayes", "WR", 1997, 76, { REC: 18, YDS: 290, TD: 0 }),
      P("Keith Jackson", "TE", 1996, 85, { REC: 40, YDS: 505, TD: 10 }),
      P("Sean Jones", "EDGE", 1996, 85, { SACKS: 5, TKL: 42 }),
      P("Gilbert Brown", "DT", 1996, 86, { TKL: 58, SACKS: 1 }),
      P("George Koonce", "LB", 1996, 80, { TKL: 97, SACKS: 1 }),
      P("Brian Williams", "LB", 1997, 79, { TKL: 90 }),
      P("Doug Evans", "CB", 1996, 80, { INT: 5, PD: 15 }),
      P("Eugene Robinson", "S", 1996, 84, { INT: 6, TKL: 78 }),
      P("Sterling Sharpe", "WR", 1994, 92, { REC: 94, YDS: 1119, TD: 18 }),
      P("Desmond Howard", "WR", 1996, 79, { REC: 13, YDS: 95, TD: 3 }),
      P("Bernardo Harris", "LB", 1997, 78, { TKL: 88 }),
      P("Darius Holland", "DT", 1996, 76, { SACKS: 2, TKL: 25 })
    ]
  },
  {
    team: "DET",
    era: "1994–1998",
    players: [
      P("Scott Mitchell", "QB", 1995, 84, { YDS: 4338, TD: 32, INT: 12 }),
      P("Barry Sanders", "RB", 1997, 99, { RUYDS: 2053, TD: 11, YPC: 6.1 }),
      P("Herman Moore", "WR", 1995, 92, { REC: 123, YDS: 1686, TD: 14 }),
      P("Brett Perriman", "WR", 1995, 84, { REC: 108, YDS: 1488, TD: 9 }),
      P("David Sloan", "TE", 1997, 78, { REC: 29, YDS: 264, TD: 0 }),
      P("Robert Porcher", "EDGE", 1997, 87, { SACKS: 12.5, TKL: 42 }),
      P("Luther Elliss", "DT", 1996, 84, { SACKS: 6, TKL: 48 }),
      P("Chris Spielman", "LB", 1994, 88, { TKL: 148, SACKS: 1 }),
      P("Ryan McNeil", "CB", 1997, 82, { INT: 9, PD: 16 }),
      P("Bennie Blades", "S", 1995, 84, { TKL: 102, INT: 1 }),
      P("Johnnie Morton", "WR", 1997, 84, { REC: 80, YDS: 1057, TD: 6 }),
      P("Ron Rivers", "RB", 1997, 76, { RUYDS: 166, YPC: 4.6, REC: 12 }),
      P("Pete Metzelaars", "TE", 1996, 76, { REC: 21, YDS: 193, TD: 2 }),
      P("Tracy Scroggins", "EDGE", 1995, 81, { SACKS: 9.5, TKL: 37 }),
      P("Henry Thomas", "DT", 1997, 84, { SACKS: 8, TKL: 48 }),
      P("Reggie Brown", "LB", 1997, 82, { TKL: 112 }),
      P("Stephen Boyd", "LB", 1997, 84, { TKL: 142, INT: 1 }),
      P("Corey Raymond", "CB", 1996, 77, { INT: 3, PD: 9 }),
      P("Ron Rice", "S", 1997, 78, { TKL: 81, INT: 2 }),
      P("Charlie Batch", "QB", 1998, 79, { YDS: 2178, TD: 11, INT: 6 }),
      P("Mark Carrier", "S", 1998, 80, { TKL: 82, INT: 2 }),
      P("Germane Crowell", "WR", 1998, 76, { REC: 25, YDS: 464, TD: 2 }),
      P("Antonio London", "LB", 1995, 76, { TKL: 60 })
    ]
  },
  {
    team: "NYG",
    era: "1984–1990",
    players: [
      P("Phil Simms", "QB", 1986, 86, { YDS: 3487, TD: 21, INT: 22 }),
      P("Joe Morris", "RB", 1986, 87, { RUYDS: 1516, TD: 14, YPC: 4.4 }),
      P("Lionel Manuel", "WR", 1988, 80, { REC: 65, YDS: 1029, TD: 4 }),
      P("Stephen Baker", "WR", 1988, 78, { REC: 40, YDS: 656, TD: 7 }),
      P("Mark Bavaro", "TE", 1986, 91, { REC: 66, YDS: 1001, TD: 4 }),
      P("Lawrence Taylor", "EDGE", 1986, 99, { SACKS: 20.5, TKL: 105, FF: 2 }),
      P("Leonard Marshall", "DT", 1985, 88, { SACKS: 15.5, TKL: 66 }),
      P("Harry Carson", "LB", 1986, 90, { TKL: 118, SACKS: 2 }),
      P("Carl Banks", "LB", 1987, 88, { TKL: 120, SACKS: 9 }),
      P("Mark Collins", "CB", 1990, 84, { INT: 2, PD: 13 }),
      P("Terry Kinard", "S", 1988, 82, { INT: 5, TKL: 84 }),
      P("Ottis Anderson", "RB", 1989, 83, { RUYDS: 1023, TD: 14, YPC: 3.9 }),
      P("Rodney Hampton", "RB", 1990, 82, { RUYDS: 455, TD: 2, YPC: 4.3 }),
      P("Dave Meggett", "RB", 1989, 81, { REC: 34, RECYDS: 531, TD: 4 }),
      P("Odessa Turner", "WR", 1988, 76, { REC: 10, YDS: 128, TD: 1 }),
      P("Zeke Mowatt", "TE", 1985, 78, { REC: 48, YDS: 597, TD: 2 }),
      P("Jim Burt", "DT", 1986, 84, { TKL: 61, SACKS: 3 }),
      P("Erik Howard", "DT", 1990, 83, { SACKS: 4, TKL: 50 }),
      P("Pepper Johnson", "LB", 1990, 86, { TKL: 102, SACKS: 3.5 }),
      P("Gary Reasons", "LB", 1986, 80, { TKL: 80, INT: 2 }),
      P("Perry Williams", "CB", 1986, 79, { INT: 2, PD: 11 }),
      P("Terry Kinard", "S", 1986, 82, { INT: 4, TKL: 70 }),
      P("Jeff Hostetler", "QB", 1990, 80, { YDS: 614, TD: 3, INT: 1 }),
      P("Bobby Johnson", "WR", 1984, 76, { REC: 48, YDS: 795, TD: 7 }),
      P("Maurice Carthon", "RB", 1986, 76, { RUYDS: 260, REC: 14, TD: 0 }),
      P("Eric Dorsey", "DT", 1988, 76, { SACKS: 3, TKL: 32 })
    ]
  },
  {
    team: "MIN",
    era: "1996–2000",
    players: [
      P("Randall Cunningham", "QB", 1998, 91, { YDS: 3704, TD: 34, INT: 10, RTG: 106.0 }),
      P("Robert Smith", "RB", 1997, 87, { RUYDS: 1266, TD: 6, YPC: 5.5 }),
      P("Randy Moss", "WR", 1998, 96, { REC: 69, YDS: 1313, TD: 17 }),
      P("Cris Carter", "WR", 1999, 92, { REC: 90, YDS: 1241, TD: 13 }),
      P("Andrew Glover", "TE", 1998, 78, { REC: 35, YDS: 522, TD: 5 }),
      P("Derrick Alexander", "EDGE", 1997, 80, { SACKS: 6, TKL: 39 }),
      P("John Randle", "DT", 1997, 94, { SACKS: 15.5, TKL: 53 }),
      P("Dwayne Rudd", "LB", 1999, 81, { TKL: 87, SACKS: 2, TD: 2 }),
      P("Corey Fuller", "CB", 1998, 79, { INT: 2, PD: 12 }),
      P("Orlando Thomas", "S", 1997, 81, { INT: 3, TKL: 89 }),
      P("Daunte Culpepper", "QB", 2000, 90, { YDS: 3937, TD: 33, INT: 16, RUYDS: 470 }),
      P("Leroy Hoard", "RB", 1998, 78, { RUYDS: 479, TD: 9, YPC: 4.4 }),
      P("Jake Reed", "WR", 1996, 85, { REC: 72, YDS: 1320, TD: 7 }),
      P("Matthew Hatchette", "WR", 1999, 76, { REC: 21, YDS: 308, TD: 2 }),
      P("Hunter Goodwin", "TE", 1997, 74, { REC: 6, YDS: 56, TD: 0 }),
      P("Duane Clemons", "EDGE", 1999, 78, { SACKS: 5, TKL: 36 }),
      P("Tony Williams", "DT", 1999, 77, { SACKS: 4, TKL: 30 }),
      P("Ed McDaniel", "LB", 1998, 82, { TKL: 118, SACKS: 3 }),
      P("Jimmy Hitchcock", "CB", 1998, 82, { INT: 7, PD: 14, TD: 3 }),
      P("Robert Griffith", "S", 1998, 84, { TKL: 100, INT: 3 }),
      P("Brad Johnson", "QB", 1996, 83, { YDS: 2258, TD: 17, INT: 10 }),
      P("Chris Hovan", "DT", 2000, 79, { SACKS: 3, TKL: 42 }),
      P("Kailee Wong", "LB", 1998, 77, { SACKS: 4, TKL: 45 }),
      P("Robert Tate", "CB", 2000, 76, { INT: 3, PD: 8 })
    ]
  },
  {
    team: "DEN",
    era: "1996–1998",
    players: [
      P("John Elway", "QB", 1997, 92, { YDS: 3635, TD: 27, INT: 11 }),
      P("Terrell Davis", "RB", 1998, 97, { RUYDS: 2008, TD: 21, YPC: 5.1 }),
      P("Rod Smith", "WR", 1997, 89, { REC: 70, YDS: 1180, TD: 12 }),
      P("Ed McCaffrey", "WR", 1998, 87, { REC: 64, YDS: 1053, TD: 10 }),
      P("Shannon Sharpe", "TE", 1997, 93, { REC: 72, YDS: 1107, TD: 3 }),
      P("Alfred Williams", "EDGE", 1996, 84, { SACKS: 13, TKL: 46 }),
      P("Trevor Pryce", "DT", 1998, 87, { SACKS: 8.5, TKL: 40 }),
      P("John Mobley", "LB", 1997, 84, { TKL: 111, SACKS: 3 }),
      P("Ray Crockett", "CB", 1997, 81, { INT: 4, PD: 13 }),
      P("Steve Atwater", "S", 1996, 90, { TKL: 100, INT: 3 }),
      P("Derek Loville", "RB", 1997, 77, { RUYDS: 124, TD: 2, YPC: 4.4 }),
      P("Vaughn Hebron", "RB", 1998, 76, { RUYDS: 222, YPC: 4.7 }),
      P("Willie Green", "WR", 1997, 76, { REC: 19, YDS: 240, TD: 2 }),
      P("Dwayne Carswell", "TE", 1998, 76, { REC: 12, YDS: 106, TD: 1 }),
      P("Neil Smith", "EDGE", 1997, 86, { SACKS: 8.5, TKL: 40 }),
      P("Keith Traylor", "DT", 1997, 80, { TKL: 41, SACKS: 2 }),
      P("Bill Romanowski", "LB", 1997, 85, { TKL: 90, SACKS: 3, INT: 2 }),
      P("Allen Aldridge", "LB", 1997, 78, { TKL: 85 }),
      P("Darrien Gordon", "CB", 1997, 82, { INT: 4, PD: 12 }),
      P("Tyrone Braxton", "S", 1997, 84, { INT: 9, TKL: 70 }),
      P("Maa Tanuvasa", "EDGE", 1998, 80, { SACKS: 8.5, TKL: 36 }),
      P("Bubby Brister", "QB", 1998, 78, { YDS: 1156, TD: 10, INT: 4 }),
      P("Howard Griffith", "RB", 1998, 76, { RUYDS: 6, REC: 26, TD: 4 }),
      P("Randy Hilliard", "CB", 1996, 75, { INT: 2, PD: 7 })
    ]
  },
  {
    team: "BUF",
    era: "2020–2024",
    players: [
      P("Josh Allen", "QB", 2020, 95, { YDS: 4544, TD: 37, INT: 10, RUYDS: 421 }),
      P("James Cook", "RB", 2024, 86, { RUYDS: 1009, TD: 16, YPC: 4.9 }),
      P("Stefon Diggs", "WR", 2020, 93, { REC: 127, YDS: 1535, TD: 8 }),
      P("Gabe Davis", "WR", 2022, 82, { REC: 48, YDS: 836, TD: 7 }),
      P("Dawson Knox", "TE", 2021, 82, { REC: 49, YDS: 587, TD: 9 }),
      P("Von Miller", "EDGE", 2022, 88, { SACKS: 8, TKL: 21 }),
      P("Ed Oliver", "DT", 2023, 86, { SACKS: 9.5, TKL: 51 }),
      P("Matt Milano", "LB", 2022, 88, { TKL: 99, INT: 3 }),
      P("Tre'Davious White", "CB", 2019, 89, { INT: 6, PD: 17 }),
      P("Jordan Poyer", "S", 2021, 87, { INT: 5, TKL: 93 }),
      P("Devin Singletary", "RB", 2021, 81, { RUYDS: 870, TD: 7, YPC: 4.6 }),
      P("Zack Moss", "RB", 2020, 77, { RUYDS: 481, TD: 4, YPC: 4.3 }),
      P("Cole Beasley", "WR", 2020, 84, { REC: 82, YDS: 967, TD: 4 }),
      P("Khalil Shakir", "WR", 2024, 82, { REC: 76, YDS: 821, TD: 4 }),
      P("Dalton Kincaid", "TE", 2023, 81, { REC: 73, YDS: 673, TD: 2 }),
      P("Greg Rousseau", "EDGE", 2023, 84, { SACKS: 8, TKL: 42 }),
      P("DaQuan Jones", "DT", 2022, 82, { TKL: 44, SACKS: 2 }),
      P("Terrel Bernard", "LB", 2023, 85, { TKL: 143, SACKS: 6.5, INT: 3 }),
      P("Taron Johnson", "CB", 2023, 85, { TKL: 90, PD: 8 }),
      P("Damar Hamlin", "S", 2022, 78, { TKL: 91 }),
      P("Christian Benford", "CB", 2024, 84, { INT: 2, PD: 12 }),
      P("Micah Hyde", "S", 2021, 84, { INT: 5, TKL: 74 }),
      P("A.J. Epenesa", "EDGE", 2023, 80, { SACKS: 6.5, TKL: 30 }),
      P("Ray Davis", "RB", 2024, 77, { RUYDS: 442, TD: 3, YPC: 5.0 })
    ]
  },
  {
    team: "MIA",
    era: "1970–1974",
    players: [
      P("Bob Griese", "QB", 1971, 88, { YDS: 2089, TD: 19, INT: 9, RTG: 90.9 }),
      P("Larry Csonka", "RB", 1972, 91, { RUYDS: 1117, TD: 6, YPC: 5.2 }),
      P("Mercury Morris", "RB", 1972, 86, { RUYDS: 1000, TD: 12, YPC: 5.3 }),
      P("Jim Kiick", "RB", 1970, 80, { RUYDS: 658, TD: 5, REC: 42 }),
      P("Paul Warfield", "WR", 1971, 93, { REC: 43, YDS: 996, TD: 11 }),
      P("Howard Twilley", "WR", 1971, 78, { REC: 23, YDS: 400, TD: 3 }),
      P("Marlin Briscoe", "WR", 1972, 77, { REC: 16, YDS: 279, TD: 4 }),
      P("Jim Mandich", "TE", 1974, 78, { REC: 26, YDS: 340, TD: 5 }),
      P("Bill Stanfill", "EDGE", 1973, 88, { SACKS: 18.5, TKL: 47 }),
      P("Vern Den Herder", "EDGE", 1974, 82, { SACKS: 9, TKL: 40 }),
      P("Manny Fernandez", "DT", 1972, 87, { SACKS: 6, TKL: 62 }),
      P("Bob Heinz", "DT", 1972, 78, { SACKS: 4, TKL: 35 }),
      P("Nick Buoniconti", "LB", 1973, 91, { TKL: 122, INT: 3 }),
      P("Doug Swift", "LB", 1972, 80, { TKL: 70, INT: 3 }),
      P("Mike Kolen", "LB", 1972, 78, { TKL: 68, INT: 2 }),
      P("Dick Anderson", "S", 1973, 89, { INT: 8, TKL: 70 }),
      P("Jake Scott", "S", 1972, 88, { INT: 5, TKL: 62 }),
      P("Curtis Johnson", "CB", 1972, 81, { INT: 3, PD: 10 }),
      P("Lloyd Mumphord", "CB", 1971, 78, { INT: 4, PD: 9 }),
      P("Tim Foley", "CB", 1973, 79, { INT: 2, PD: 11 })
    ]
  },
  {
    team: "DAL",
    era: "1977–1982",
    players: [
      P("Roger Staubach", "QB", 1977, 91, { YDS: 2620, TD: 18, INT: 9, RTG: 87.0 }),
      P("Danny White", "QB", 1981, 85, { YDS: 3098, TD: 22, INT: 13 }),
      P("Tony Dorsett", "RB", 1981, 93, { RUYDS: 1646, TD: 4, YPC: 4.8 }),
      P("Robert Newhouse", "RB", 1977, 79, { RUYDS: 721, TD: 6, YPC: 4.0 }),
      P("Preston Pearson", "RB", 1978, 78, { REC: 47, RECYDS: 526, TD: 3 }),
      P("Drew Pearson", "WR", 1977, 88, { REC: 48, YDS: 870, TD: 2 }),
      P("Tony Hill", "WR", 1979, 87, { REC: 60, YDS: 1062, TD: 10 }),
      P("Butch Johnson", "WR", 1981, 78, { REC: 25, YDS: 552, TD: 5 }),
      P("Billy Joe DuPree", "TE", 1977, 82, { REC: 28, YDS: 347, TD: 4 }),
      P("Doug Cosbie", "TE", 1982, 79, { REC: 30, YDS: 441, TD: 6 }),
      P("Harvey Martin", "EDGE", 1977, 92, { SACKS: 23, TKL: 55 }),
      P("Ed 'Too Tall' Jones", "EDGE", 1982, 89, { SACKS: 10.5, TKL: 45 }),
      P("Randy White", "DT", 1978, 96, { SACKS: 16, TKL: 70 }),
      P("Larry Cole", "DT", 1977, 80, { SACKS: 6, TKL: 40 }),
      P("John Dutton", "DT", 1981, 82, { SACKS: 7, TKL: 42 }),
      P("Bob Breunig", "LB", 1980, 84, { TKL: 110, INT: 2 }),
      P("D.D. Lewis", "LB", 1978, 80, { TKL: 85, INT: 2 }),
      P("Mike Hegman", "LB", 1980, 78, { TKL: 70, SACKS: 3 }),
      P("Everson Walls", "CB", 1981, 88, { INT: 11, PD: 16 }),
      P("Benny Barnes", "CB", 1978, 80, { INT: 4, PD: 10 }),
      P("Cliff Harris", "S", 1977, 91, { INT: 5, TKL: 80 }),
      P("Charlie Waters", "S", 1977, 88, { INT: 6, TKL: 75 })
    ]
  },
  {
    team: "OAK",
    era: "1976–1983",
    players: [
      P("Ken Stabler", "QB", 1976, 90, { YDS: 2737, TD: 27, INT: 17, RTG: 103.4 }),
      P("Jim Plunkett", "QB", 1980, 84, { YDS: 2299, TD: 18, INT: 16 }),
      P("Marcus Allen", "RB", 1983, 91, { RUYDS: 1014, TD: 9, REC: 68, RECYDS: 590 }),
      P("Mark van Eeghen", "RB", 1977, 84, { RUYDS: 1273, TD: 7, YPC: 4.0 }),
      P("Clarence Davis", "RB", 1976, 78, { RUYDS: 516, TD: 3, YPC: 4.3 }),
      P("Cliff Branch", "WR", 1976, 89, { REC: 46, YDS: 1111, TD: 12 }),
      P("Fred Biletnikoff", "WR", 1976, 86, { REC: 43, YDS: 551, TD: 7 }),
      P("Dave Casper", "TE", 1976, 91, { REC: 53, YDS: 691, TD: 10 }),
      P("Todd Christensen", "TE", 1983, 89, { REC: 92, YDS: 1247, TD: 12 }),
      P("Howie Long", "EDGE", 1983, 91, { SACKS: 13, TKL: 54 }),
      P("Lyle Alzado", "EDGE", 1983, 85, { SACKS: 7, TKL: 42 }),
      P("John Matuszak", "DT", 1976, 83, { SACKS: 6, TKL: 45 }),
      P("Otis Sistrunk", "DT", 1976, 81, { SACKS: 5, TKL: 40 }),
      P("Ted Hendricks", "LB", 1980, 93, { TKL: 70, SACKS: 9, INT: 3 }),
      P("Rod Martin", "LB", 1983, 85, { TKL: 90, SACKS: 4, INT: 3 }),
      P("Matt Millen", "LB", 1980, 81, { TKL: 88 }),
      P("Lester Hayes", "CB", 1980, 94, { INT: 13, PD: 20 }),
      P("Mike Haynes", "CB", 1983, 92, { INT: 2, PD: 15 }),
      P("Willie Brown", "CB", 1976, 88, { INT: 4, PD: 12 }),
      P("Jack Tatum", "S", 1976, 88, { INT: 3, TKL: 75 }),
      P("Vann McElroy", "S", 1983, 81, { INT: 7, TKL: 62 })
    ]
  },
  {
    team: "WAS",
    era: "1982–1991",
    players: [
      P("Joe Theismann", "QB", 1983, 89, { YDS: 3714, TD: 29, INT: 11, RTG: 97.0 }),
      P("Mark Rypien", "QB", 1991, 88, { YDS: 3564, TD: 28, INT: 11, RTG: 97.9 }),
      P("John Riggins", "RB", 1983, 90, { RUYDS: 1347, TD: 24, YPC: 3.9 }),
      P("Earnest Byner", "RB", 1990, 84, { RUYDS: 1219, TD: 6, YPC: 4.1 }),
      P("George Rogers", "RB", 1986, 82, { RUYDS: 1203, TD: 18, YPC: 3.8 }),
      P("Art Monk", "WR", 1984, 92, { REC: 106, YDS: 1372, TD: 7 }),
      P("Gary Clark", "WR", 1991, 88, { REC: 70, YDS: 1340, TD: 10 }),
      P("Ricky Sanders", "WR", 1988, 85, { REC: 73, YDS: 1148, TD: 12 }),
      P("Don Warren", "TE", 1984, 77, { REC: 18, YDS: 192, TD: 1 }),
      P("Clint Didier", "TE", 1987, 78, { REC: 23, YDS: 332, TD: 4 }),
      P("Dexter Manley", "EDGE", 1986, 90, { SACKS: 18.5, TKL: 55 }),
      P("Charles Mann", "EDGE", 1989, 87, { SACKS: 10, TKL: 60 }),
      P("Dave Butz", "DT", 1983, 85, { SACKS: 11.5, TKL: 60 }),
      P("Darryl Grant", "DT", 1985, 79, { SACKS: 5, TKL: 40 }),
      P("Wilber Marshall", "LB", 1991, 87, { TKL: 92, SACKS: 5.5, INT: 5 }),
      P("Monte Coleman", "LB", 1984, 81, { TKL: 78, SACKS: 4 }),
      P("Neal Olkewicz", "LB", 1983, 79, { TKL: 100 }),
      P("Darrell Green", "CB", 1986, 93, { INT: 5, PD: 12 }),
      P("Barry Wilburn", "CB", 1987, 82, { INT: 9, PD: 14 }),
      P("Todd Bowles", "S", 1987, 80, { INT: 4, TKL: 70 }),
      P("Alvin Walton", "S", 1988, 79, { TKL: 96, INT: 2 })
    ]
  },
  {
    team: "PHI",
    era: "1988–1992",
    players: [
      P("Randall Cunningham", "QB", 1990, 91, { YDS: 3466, TD: 30, INT: 13, RUYDS: 942 }),
      P("Herschel Walker", "RB", 1992, 84, { RUYDS: 1070, TD: 8, YPC: 4.5 }),
      P("Keith Byars", "RB", 1990, 83, { REC: 81, RECYDS: 819, RUYDS: 141, TD: 4 }),
      P("Heath Sherman", "RB", 1991, 78, { RUYDS: 279, TD: 1, YPC: 4.0 }),
      P("Fred Barnett", "WR", 1992, 85, { REC: 67, YDS: 1083, TD: 6 }),
      P("Calvin Williams", "WR", 1990, 82, { REC: 37, YDS: 602, TD: 9 }),
      P("Cris Carter", "WR", 1989, 82, { REC: 45, YDS: 605, TD: 11 }),
      P("Keith Jackson", "TE", 1988, 89, { REC: 81, YDS: 869, TD: 6 }),
      P("Reggie White", "EDGE", 1988, 99, { SACKS: 18, TKL: 72, FF: 4 }),
      P("Clyde Simmons", "EDGE", 1992, 90, { SACKS: 19, TKL: 54, FF: 3 }),
      P("Jerome Brown", "DT", 1991, 91, { SACKS: 9, TKL: 88 }),
      P("Mike Golic", "DT", 1991, 78, { SACKS: 3, TKL: 40 }),
      P("Mike Pitts", "DT", 1990, 77, { SACKS: 4, TKL: 33 }),
      P("Seth Joyner", "LB", 1991, 92, { TKL: 110, SACKS: 6.5, INT: 3, FF: 6 }),
      P("Byron Evans", "LB", 1992, 83, { TKL: 130, INT: 2 }),
      P("William Thomas", "LB", 1992, 82, { TKL: 82, SACKS: 3, INT: 2 }),
      P("Eric Allen", "CB", 1989, 90, { INT: 8, PD: 16, TD: 1 }),
      P("Ben Smith", "CB", 1990, 80, { INT: 3, PD: 10 }),
      P("Otis Smith", "CB", 1991, 77, { INT: 2, PD: 8 }),
      P("Wes Hopkins", "S", 1988, 85, { TKL: 95, INT: 5 }),
      P("Andre Waters", "S", 1991, 84, { TKL: 105, INT: 3 })
    ]
  },
  {
    team: "BUF",
    era: "1990–1993",
    players: [
      P("Jim Kelly", "QB", 1991, 91, { YDS: 3844, TD: 33, INT: 17, RTG: 97.6 }),
      P("Thurman Thomas", "RB", 1991, 95, { RUYDS: 1407, TD: 7, REC: 62, RECYDS: 631 }),
      P("Kenneth Davis", "RB", 1992, 79, { RUYDS: 613, TD: 6, YPC: 4.4 }),
      P("Andre Reed", "WR", 1991, 91, { REC: 81, YDS: 1113, TD: 10 }),
      P("James Lofton", "WR", 1991, 85, { REC: 57, YDS: 1072, TD: 8 }),
      P("Don Beebe", "WR", 1992, 78, { REC: 33, YDS: 554, TD: 2 }),
      P("Pete Metzelaars", "TE", 1993, 78, { REC: 68, YDS: 609, TD: 4 }),
      P("Keith McKeller", "TE", 1990, 76, { REC: 34, YDS: 464, TD: 5 }),
      P("Bruce Smith", "EDGE", 1990, 99, { SACKS: 19, TKL: 101, FF: 4 }),
      P("Phil Hansen", "EDGE", 1993, 82, { SACKS: 8, TKL: 60 }),
      P("Bryce Paup", "EDGE", 1992, 82, { SACKS: 6.5, TKL: 40 }),
      P("Jeff Wright", "DT", 1992, 81, { SACKS: 6, TKL: 55 }),
      P("Cornelius Bennett", "LB", 1991, 90, { TKL: 108, SACKS: 9, FF: 3 }),
      P("Darryl Talley", "LB", 1991, 87, { TKL: 117, SACKS: 4, INT: 5 }),
      P("Shane Conlan", "LB", 1990, 84, { TKL: 96, INT: 1 }),
      P("Nate Odomes", "CB", 1993, 85, { INT: 9, PD: 15 }),
      P("Kirby Jackson", "CB", 1991, 78, { INT: 3, PD: 9 }),
      P("Henry Jones", "S", 1992, 86, { INT: 8, TKL: 90, TD: 2 }),
      P("Mark Kelso", "S", 1990, 80, { INT: 6, TKL: 70 })
    ]
  },
  {
    team: "SF",
    era: "1993–1998",
    players: [
      P("Steve Young", "QB", 1994, 96, { YDS: 3969, TD: 35, INT: 10, RTG: 112.8 }),
      P("Jerry Rice", "WR", 1995, 97, { REC: 122, YDS: 1848, TD: 15 }),
      P("Terrell Owens", "WR", 1998, 88, { REC: 67, YDS: 1097, TD: 14 }),
      P("John Taylor", "WR", 1993, 84, { REC: 56, YDS: 940, TD: 5 }),
      P("J.J. Stokes", "WR", 1997, 78, { REC: 58, YDS: 733, TD: 4 }),
      P("Ricky Watters", "RB", 1993, 88, { RUYDS: 950, TD: 10, REC: 31 }),
      P("Garrison Hearst", "RB", 1998, 89, { RUYDS: 1570, TD: 7, YPC: 5.1 }),
      P("William Floyd", "RB", 1994, 79, { RUYDS: 305, TD: 6, REC: 19 }),
      P("Brent Jones", "TE", 1994, 85, { REC: 49, YDS: 670, TD: 9 }),
      P("Dana Stubblefield", "DT", 1997, 92, { SACKS: 15, TKL: 58 }),
      P("Bryant Young", "DT", 1996, 91, { SACKS: 11.5, TKL: 55 }),
      P("Chris Doleman", "EDGE", 1996, 87, { SACKS: 11, TKL: 45 }),
      P("Rickey Jackson", "EDGE", 1994, 84, { SACKS: 6.5, TKL: 40 }),
      P("Roy Barker", "EDGE", 1997, 80, { SACKS: 9, TKL: 38 }),
      P("Ken Norton Jr.", "LB", 1995, 86, { TKL: 118, SACKS: 2 }),
      P("Gary Plummer", "LB", 1994, 80, { TKL: 90, SACKS: 2 }),
      P("Lee Woodall", "LB", 1996, 81, { TKL: 88, SACKS: 3 }),
      P("Deion Sanders", "CB", 1994, 97, { INT: 6, PD: 15, TD: 3 }),
      P("Rod Woodson", "CB", 1997, 84, { INT: 1, PD: 10 }),
      P("Merton Hanks", "S", 1994, 87, { INT: 7, TKL: 71 }),
      P("Tim McDonald", "S", 1993, 85, { INT: 2, TKL: 90 }),
      P("Marquez Pope", "S", 1996, 79, { INT: 3, TKL: 70 })
    ]
  },
  {
    team: "TEN",
    era: "1999–2003",
    players: [
      P("Steve McNair", "QB", 2003, 89, { YDS: 3215, TD: 24, INT: 7, RTG: 100.4 }),
      P("Eddie George", "RB", 2000, 89, { RUYDS: 1509, TD: 14, YPC: 3.7 }),
      P("Chris Brown", "RB", 2003, 78, { RUYDS: 221, TD: 1, YPC: 5.0 }),
      P("Derrick Mason", "WR", 2003, 87, { REC: 95, YDS: 1303, TD: 8 }),
      P("Kevin Dyson", "WR", 1999, 79, { REC: 54, YDS: 658, TD: 4 }),
      P("Yancey Thigpen", "WR", 1999, 78, { REC: 38, YDS: 648, TD: 3 }),
      P("Drew Bennett", "WR", 2003, 78, { REC: 32, YDS: 511, TD: 3 }),
      P("Frank Wycheck", "TE", 1999, 84, { REC: 69, YDS: 641, TD: 2 }),
      P("Jevon Kearse", "EDGE", 1999, 94, { SACKS: 14.5, TKL: 55, FF: 8 }),
      P("Kevin Carter", "EDGE", 2001, 87, { SACKS: 10.5, TKL: 55 }),
      P("Albert Haynesworth", "DT", 2003, 83, { SACKS: 3, TKL: 40 }),
      P("Josh Evans", "DT", 2000, 79, { SACKS: 4, TKL: 44 }),
      P("Keith Bulluck", "LB", 2003, 88, { TKL: 137, INT: 3, FF: 2 }),
      P("Randall Godfrey", "LB", 2001, 82, { TKL: 132, SACKS: 2 }),
      P("Eddie Robinson", "LB", 1999, 79, { TKL: 90 }),
      P("Samari Rolle", "CB", 2000, 88, { INT: 7, PD: 15, TD: 1 }),
      P("Andre Dyson", "CB", 2002, 80, { INT: 4, PD: 11 }),
      P("Blaine Bishop", "S", 1999, 84, { TKL: 90, INT: 1 }),
      P("Lance Schulters", "S", 2002, 79, { INT: 3, TKL: 76 }),
      P("Tank Williams", "S", 2003, 78, { TKL: 82, INT: 2 })
    ]
  },
  {
    team: "TB",
    era: "1999–2002",
    players: [
      P("Brad Johnson", "QB", 2002, 84, { YDS: 3049, TD: 22, INT: 6, RTG: 92.9 }),
      P("Shaun King", "QB", 1999, 76, { YDS: 875, TD: 7, INT: 4 }),
      P("Mike Alstott", "RB", 1999, 85, { RUYDS: 949, TD: 7, REC: 27 }),
      P("Warrick Dunn", "RB", 2000, 84, { RUYDS: 1133, TD: 8, REC: 44 }),
      P("Michael Pittman", "RB", 2002, 80, { RUYDS: 718, TD: 1, REC: 59 }),
      P("Keyshawn Johnson", "WR", 2001, 86, { REC: 106, YDS: 1266, TD: 1 }),
      P("Keenan McCardell", "WR", 2002, 83, { REC: 61, YDS: 670, TD: 6 }),
      P("Joe Jurevicius", "WR", 2002, 79, { REC: 37, YDS: 423, TD: 4 }),
      P("Jacquez Green", "WR", 1999, 77, { REC: 37, YDS: 791, TD: 2 }),
      P("Ken Dilger", "TE", 2002, 78, { REC: 26, YDS: 329, TD: 1 }),
      P("Simeon Rice", "EDGE", 2002, 92, { SACKS: 15.5, TKL: 45, FF: 3 }),
      P("Greg Spires", "EDGE", 2002, 79, { SACKS: 5.5, TKL: 35 }),
      P("Warren Sapp", "DT", 2000, 96, { SACKS: 16.5, TKL: 60 }),
      P("Anthony McFarland", "DT", 2002, 81, { SACKS: 3, TKL: 32 }),
      P("Derrick Brooks", "LB", 2002, 98, { TKL: 117, INT: 5, TD: 3 }),
      P("Shelton Quarles", "LB", 2002, 83, { TKL: 100, SACKS: 1 }),
      P("Al Singleton", "LB", 2001, 78, { TKL: 76 }),
      P("Ronde Barber", "CB", 2001, 91, { INT: 10, PD: 20, SACKS: 1 }),
      P("Brian Kelly", "CB", 2002, 85, { INT: 8, PD: 15 }),
      P("John Lynch", "S", 1999, 92, { TKL: 86, INT: 2, FF: 2 }),
      P("Dexter Jackson", "S", 2002, 80, { INT: 4, TKL: 63 })
    ]
  },
  {
    team: "SD",
    era: "2004–2009",
    players: [
      P("Philip Rivers", "QB", 2008, 91, { YDS: 4009, TD: 34, INT: 11, RTG: 105.5 }),
      P("Drew Brees", "QB", 2004, 86, { YDS: 3159, TD: 27, INT: 7, RTG: 104.8 }),
      P("LaDainian Tomlinson", "RB", 2006, 99, { RUYDS: 1815, TD: 31, REC: 56, RECYDS: 508 }),
      P("Michael Turner", "RB", 2006, 80, { RUYDS: 502, TD: 2, YPC: 6.3 }),
      P("Darren Sproles", "RB", 2008, 82, { RUYDS: 330, REC: 29, TD: 6 }),
      P("Antonio Gates", "TE", 2005, 94, { REC: 89, YDS: 1101, TD: 10 }),
      P("Vincent Jackson", "WR", 2009, 87, { REC: 68, YDS: 1167, TD: 9 }),
      P("Malcom Floyd", "WR", 2009, 80, { REC: 45, YDS: 776, TD: 1 }),
      P("Chris Chambers", "WR", 2008, 79, { REC: 33, YDS: 462, TD: 5 }),
      P("Keenan McCardell", "WR", 2005, 78, { REC: 70, YDS: 917, TD: 3 }),
      P("Shawne Merriman", "EDGE", 2006, 94, { SACKS: 17, TKL: 58, FF: 3 }),
      P("Shaun Phillips", "EDGE", 2009, 85, { SACKS: 7, TKL: 47 }),
      P("Jamal Williams", "DT", 2006, 89, { TKL: 60, SACKS: 2 }),
      P("Luis Castillo", "DT", 2006, 82, { SACKS: 5, TKL: 50 }),
      P("Igor Olshansky", "DT", 2007, 78, { TKL: 38, SACKS: 2 }),
      P("Donnie Edwards", "LB", 2004, 86, { TKL: 148, INT: 3 }),
      P("Stephen Cooper", "LB", 2008, 79, { TKL: 89, SACKS: 2 }),
      P("Antonio Cromartie", "CB", 2007, 88, { INT: 10, PD: 18, TD: 3 }),
      P("Quentin Jammer", "CB", 2007, 82, { INT: 2, PD: 15 }),
      P("Eric Weddle", "S", 2009, 86, { INT: 3, TKL: 92 }),
      P("Marlon McCree", "S", 2006, 79, { INT: 5, TKL: 72 })
    ]
  },
  {
    team: "PIT",
    era: "2005–2010",
    players: [
      P("Ben Roethlisberger", "QB", 2007, 88, { YDS: 3154, TD: 32, INT: 11, RTG: 104.1 }),
      P("Willie Parker", "RB", 2006, 85, { RUYDS: 1494, TD: 13, YPC: 4.4 }),
      P("Rashard Mendenhall", "RB", 2010, 82, { RUYDS: 1273, TD: 13, YPC: 3.9 }),
      P("Jerome Bettis", "RB", 2005, 84, { RUYDS: 368, TD: 9, YPC: 3.4 }),
      P("Hines Ward", "WR", 2005, 89, { REC: 69, YDS: 975, TD: 11 }),
      P("Mike Wallace", "WR", 2010, 86, { REC: 60, YDS: 1257, TD: 10 }),
      P("Santonio Holmes", "WR", 2009, 84, { REC: 79, YDS: 1248, TD: 5 }),
      P("Nate Washington", "WR", 2007, 77, { REC: 29, YDS: 450, TD: 3 }),
      P("Heath Miller", "TE", 2009, 85, { REC: 76, YDS: 789, TD: 6 }),
      P("James Harrison", "EDGE", 2008, 96, { SACKS: 16, TKL: 101, FF: 7 }),
      P("LaMarr Woodley", "EDGE", 2009, 89, { SACKS: 13.5, TKL: 55 }),
      P("Casey Hampton", "DT", 2008, 86, { TKL: 43, SACKS: 1 }),
      P("Aaron Smith", "DT", 2008, 84, { SACKS: 5.5, TKL: 40 }),
      P("Brett Keisel", "DT", 2010, 82, { SACKS: 3, TKL: 41 }),
      P("James Farrior", "LB", 2008, 87, { TKL: 133, SACKS: 3.5 }),
      P("Lawrence Timmons", "LB", 2010, 86, { TKL: 135, SACKS: 3, INT: 2 }),
      P("Larry Foote", "LB", 2007, 79, { TKL: 68, SACKS: 1 }),
      P("Ike Taylor", "CB", 2008, 84, { PD: 13, INT: 1 }),
      P("Bryant McFadden", "CB", 2010, 79, { PD: 10, INT: 2 }),
      P("Troy Polamalu", "S", 2010, 96, { INT: 7, TKL: 63, FF: 1 }),
      P("Ryan Clark", "S", 2008, 84, { TKL: 89, INT: 2 })
    ]
  },
  {
    team: "NO",
    era: "2006–2011",
    players: [
      P("Drew Brees", "QB", 2011, 96, { YDS: 5476, TD: 46, INT: 14, RTG: 110.6 }),
      P("Darren Sproles", "RB", 2011, 87, { RUYDS: 603, REC: 86, RECYDS: 710, TD: 9 }),
      P("Pierre Thomas", "RB", 2009, 82, { RUYDS: 793, TD: 6, YPC: 5.4 }),
      P("Reggie Bush", "RB", 2008, 83, { RUYDS: 404, REC: 52, TD: 6 }),
      P("Mark Ingram", "RB", 2011, 78, { RUYDS: 474, TD: 5, YPC: 3.9 }),
      P("Marques Colston", "WR", 2007, 87, { REC: 98, YDS: 1202, TD: 11 }),
      P("Lance Moore", "WR", 2008, 82, { REC: 79, YDS: 928, TD: 10 }),
      P("Robert Meachem", "WR", 2009, 80, { REC: 45, YDS: 722, TD: 9 }),
      P("Devery Henderson", "WR", 2010, 78, { REC: 38, YDS: 464, TD: 2 }),
      P("Jimmy Graham", "TE", 2011, 93, { REC: 99, YDS: 1310, TD: 11 }),
      P("David Thomas", "TE", 2010, 76, { REC: 35, YDS: 356, TD: 2 }),
      P("Will Smith", "EDGE", 2006, 87, { SACKS: 10.5, TKL: 55 }),
      P("Charles Grant", "EDGE", 2007, 82, { SACKS: 6.5, TKL: 44 }),
      P("Junior Galette", "EDGE", 2011, 79, { SACKS: 4.5, TKL: 22 }),
      P("Sedrick Ellis", "DT", 2009, 80, { SACKS: 3, TKL: 30 }),
      P("Jonathan Vilma", "LB", 2009, 86, { TKL: 110, INT: 3 }),
      P("Scott Fujita", "LB", 2007, 79, { TKL: 88, SACKS: 4 }),
      P("Tracy Porter", "CB", 2009, 80, { INT: 4, PD: 12, TD: 1 }),
      P("Jabari Greer", "CB", 2010, 82, { INT: 2, PD: 14 }),
      P("Darren Sharper", "S", 2009, 90, { INT: 9, TD: 3, TKL: 71 }),
      P("Roman Harper", "S", 2009, 82, { TKL: 96, SACKS: 3 }),
      P("Malcolm Jenkins", "S", 2011, 82, { TKL: 78, INT: 2 })
    ]
  },
  {
    team: "NYG",
    era: "2007–2011",
    players: [
      P("Eli Manning", "QB", 2011, 88, { YDS: 4933, TD: 29, INT: 16, RTG: 92.9 }),
      P("Brandon Jacobs", "RB", 2008, 85, { RUYDS: 1089, TD: 15, YPC: 5.0 }),
      P("Ahmad Bradshaw", "RB", 2010, 84, { RUYDS: 1235, TD: 8, YPC: 4.5 }),
      P("Victor Cruz", "WR", 2011, 91, { REC: 82, YDS: 1536, TD: 9 }),
      P("Hakeem Nicks", "WR", 2011, 87, { REC: 76, YDS: 1192, TD: 7 }),
      P("Plaxico Burress", "WR", 2007, 86, { REC: 70, YDS: 1025, TD: 12 }),
      P("Mario Manningham", "WR", 2010, 81, { REC: 60, YDS: 944, TD: 9 }),
      P("Jeremy Shockey", "TE", 2007, 84, { REC: 57, YDS: 619, TD: 3 }),
      P("Jake Ballard", "TE", 2011, 77, { REC: 38, YDS: 604, TD: 4 }),
      P("Jason Pierre-Paul", "EDGE", 2011, 94, { SACKS: 16.5, TKL: 86, FF: 2 }),
      P("Justin Tuck", "EDGE", 2008, 90, { SACKS: 12, TKL: 66, FF: 3 }),
      P("Michael Strahan", "EDGE", 2007, 90, { SACKS: 9, TKL: 46 }),
      P("Osi Umenyiora", "EDGE", 2007, 89, { SACKS: 13, TKL: 45, FF: 7 }),
      P("Barry Cofield", "DT", 2008, 80, { SACKS: 3, TKL: 44 }),
      P("Chris Canty", "DT", 2011, 80, { SACKS: 4, TKL: 33 }),
      P("Antonio Pierce", "LB", 2007, 83, { TKL: 108, INT: 2 }),
      P("Michael Boley", "LB", 2011, 81, { TKL: 92, SACKS: 3, INT: 2 }),
      P("Corey Webster", "CB", 2008, 85, { INT: 4, PD: 14 }),
      P("Aaron Ross", "CB", 2007, 79, { INT: 3, PD: 12 }),
      P("Antrel Rolle", "S", 2011, 84, { INT: 2, TKL: 96 }),
      P("Kenny Phillips", "S", 2010, 82, { INT: 4, TKL: 82 })
    ]
  },
  {
    team: "GB",
    era: "2009–2014",
    players: [
      P("Aaron Rodgers", "QB", 2011, 98, { YDS: 4643, TD: 45, INT: 6, RTG: 122.5 }),
      P("Eddie Lacy", "RB", 2014, 84, { RUYDS: 1139, TD: 9, YPC: 4.6 }),
      P("Ryan Grant", "RB", 2009, 81, { RUYDS: 1253, TD: 11, YPC: 4.4 }),
      P("Jordy Nelson", "WR", 2014, 92, { REC: 98, YDS: 1519, TD: 13 }),
      P("Randall Cobb", "WR", 2014, 87, { REC: 91, YDS: 1287, TD: 12 }),
      P("Greg Jennings", "WR", 2010, 88, { REC: 76, YDS: 1265, TD: 12 }),
      P("James Jones", "WR", 2012, 82, { REC: 64, YDS: 784, TD: 14 }),
      P("Jermichael Finley", "TE", 2011, 82, { REC: 55, YDS: 767, TD: 8 }),
      P("Clay Matthews", "EDGE", 2010, 93, { SACKS: 13.5, TKL: 60, FF: 3 }),
      P("Julius Peppers", "EDGE", 2014, 86, { SACKS: 7, TKL: 40, INT: 2 }),
      P("B.J. Raji", "DT", 2010, 86, { SACKS: 6.5, TKL: 39 }),
      P("Mike Daniels", "DT", 2014, 84, { SACKS: 5.5, TKL: 38 }),
      P("Ryan Pickett", "DT", 2010, 80, { TKL: 47 }),
      P("A.J. Hawk", "LB", 2010, 80, { TKL: 111, SACKS: 3 }),
      P("Desmond Bishop", "LB", 2011, 82, { TKL: 115, SACKS: 5 }),
      P("Charles Woodson", "CB", 2009, 96, { INT: 9, TKL: 74, TD: 3 }),
      P("Tramon Williams", "CB", 2010, 86, { INT: 6, PD: 18 }),
      P("Sam Shields", "CB", 2014, 83, { INT: 2, PD: 10 }),
      P("Nick Collins", "S", 2010, 87, { INT: 4, TKL: 70 }),
      P("Morgan Burnett", "S", 2013, 82, { TKL: 108, INT: 3 }),
      P("Ha Ha Clinton-Dix", "S", 2014, 80, { INT: 1, TKL: 66 })
    ]
  },
  {
    team: "DEN",
    era: "2011–2015",
    players: [
      P("Peyton Manning", "QB", 2013, 99, { YDS: 5477, TD: 55, INT: 10, RTG: 115.1 }),
      P("Knowshon Moreno", "RB", 2013, 83, { RUYDS: 1038, TD: 10, REC: 60 }),
      P("C.J. Anderson", "RB", 2014, 83, { RUYDS: 849, TD: 8, YPC: 4.7 }),
      P("Demaryius Thomas", "WR", 2014, 92, { REC: 111, YDS: 1619, TD: 11 }),
      P("Emmanuel Sanders", "WR", 2014, 88, { REC: 101, YDS: 1404, TD: 9 }),
      P("Eric Decker", "WR", 2013, 84, { REC: 87, YDS: 1288, TD: 11 }),
      P("Wes Welker", "WR", 2013, 82, { REC: 73, YDS: 778, TD: 10 }),
      P("Julius Thomas", "TE", 2013, 86, { REC: 65, YDS: 788, TD: 12 }),
      P("Von Miller", "EDGE", 2012, 95, { SACKS: 18.5, TKL: 68, FF: 6 }),
      P("DeMarcus Ware", "EDGE", 2014, 87, { SACKS: 10, TKL: 35 }),
      P("Shaun Phillips", "EDGE", 2013, 81, { SACKS: 10, TKL: 39 }),
      P("Malik Jackson", "DT", 2015, 84, { SACKS: 5.5, TKL: 43 }),
      P("Derek Wolfe", "DT", 2015, 82, { SACKS: 5.5, TKL: 45 }),
      P("Danny Trevathan", "LB", 2013, 84, { TKL: 129, INT: 3 }),
      P("Brandon Marshall", "LB", 2015, 83, { TKL: 109, SACKS: 1.5 }),
      P("Wesley Woodyard", "LB", 2012, 81, { TKL: 117, SACKS: 5.5 }),
      P("Chris Harris Jr.", "CB", 2015, 91, { INT: 2, PD: 15 }),
      P("Aqib Talib", "CB", 2014, 87, { INT: 4, PD: 12, TD: 2 }),
      P("Bradley Roby", "CB", 2015, 80, { INT: 2, PD: 12 }),
      P("T.J. Ward", "S", 2014, 85, { TKL: 84, SACKS: 1, FF: 3 }),
      P("Darian Stewart", "S", 2015, 82, { INT: 3, TKL: 72 })
    ]
  },
  {
    team: "CAR",
    era: "2013–2017",
    players: [
      P("Cam Newton", "QB", 2015, 94, { YDS: 3837, TD: 35, INT: 10, RUYDS: 636 }),
      P("Jonathan Stewart", "RB", 2015, 83, { RUYDS: 989, TD: 6, YPC: 4.1 }),
      P("Christian McCaffrey", "RB", 2017, 84, { RUYDS: 435, REC: 80, RECYDS: 651, TD: 7 }),
      P("Mike Tolbert", "RB", 2015, 78, { RUYDS: 256, TD: 3, REC: 18 }),
      P("Kelvin Benjamin", "WR", 2014, 82, { REC: 73, YDS: 1008, TD: 9 }),
      P("Ted Ginn Jr.", "WR", 2015, 80, { REC: 44, YDS: 739, TD: 10 }),
      P("Devin Funchess", "WR", 2017, 79, { REC: 63, YDS: 840, TD: 8 }),
      P("Greg Olsen", "TE", 2015, 89, { REC: 77, YDS: 1104, TD: 7 }),
      P("Charles Johnson", "EDGE", 2013, 87, { SACKS: 11, TKL: 46 }),
      P("Mario Addison", "EDGE", 2016, 83, { SACKS: 9.5, TKL: 33 }),
      P("Kawann Short", "DT", 2015, 91, { SACKS: 11, TKL: 55, FF: 3 }),
      P("Star Lotulelei", "DT", 2015, 82, { TKL: 43, SACKS: 3 }),
      P("Luke Kuechly", "LB", 2013, 97, { TKL: 156, INT: 4, FF: 2 }),
      P("Thomas Davis", "LB", 2015, 89, { TKL: 105, SACKS: 5.5, INT: 4 }),
      P("Shaq Thompson", "LB", 2017, 81, { TKL: 76, SACKS: 1 }),
      P("Josh Norman", "CB", 2015, 91, { INT: 4, PD: 18, TD: 2 }),
      P("James Bradberry", "CB", 2017, 81, { INT: 2, PD: 10 }),
      P("Kurt Coleman", "S", 2015, 84, { INT: 7, TKL: 88 }),
      P("Roman Harper", "S", 2014, 79, { TKL: 90, SACKS: 2 }),
      P("Mike Adams", "S", 2017, 80, { INT: 2, TKL: 63 })
    ]
  },
  {
    team: "NE",
    era: "2014–2019",
    players: [
      P("Tom Brady", "QB", 2017, 94, { YDS: 4577, TD: 32, INT: 8, RTG: 102.8 }),
      P("Rob Gronkowski", "TE", 2014, 95, { REC: 82, YDS: 1124, TD: 12 }),
      P("Julian Edelman", "WR", 2016, 87, { REC: 98, YDS: 1106, TD: 3 }),
      P("Brandin Cooks", "WR", 2017, 86, { REC: 65, YDS: 1082, TD: 7 }),
      P("Chris Hogan", "WR", 2017, 80, { REC: 34, YDS: 439, TD: 5 }),
      P("Josh Gordon", "WR", 2018, 80, { REC: 40, YDS: 720, TD: 3 }),
      P("James White", "RB", 2018, 85, { REC: 87, RECYDS: 751, RUYDS: 425, TD: 12 }),
      P("LeGarrette Blount", "RB", 2016, 84, { RUYDS: 1161, TD: 18, YPC: 3.9 }),
      P("Dion Lewis", "RB", 2017, 82, { RUYDS: 896, TD: 6, YPC: 5.0 }),
      P("Sony Michel", "RB", 2018, 80, { RUYDS: 931, TD: 6, YPC: 4.5 }),
      P("Chandler Jones", "EDGE", 2015, 88, { SACKS: 12.5, TKL: 47 }),
      P("Trey Flowers", "EDGE", 2017, 86, { SACKS: 6.5, TKL: 46 }),
      P("Malcom Brown", "DT", 2016, 79, { TKL: 47, SACKS: 1 }),
      P("Danny Shelton", "DT", 2018, 78, { TKL: 39, SACKS: 1 }),
      P("Dont'a Hightower", "LB", 2016, 88, { TKL: 65, SACKS: 2.5, FF: 3 }),
      P("Jamie Collins", "LB", 2015, 87, { TKL: 89, SACKS: 5.5, INT: 1 }),
      P("Kyle Van Noy", "LB", 2019, 84, { SACKS: 6.5, TKL: 56, FF: 2 }),
      P("Stephon Gilmore", "CB", 2019, 96, { INT: 6, PD: 20, TD: 2 }),
      P("Malcolm Butler", "CB", 2016, 86, { INT: 4, PD: 17 }),
      P("J.C. Jackson", "CB", 2019, 83, { INT: 5, PD: 10 }),
      P("Devin McCourty", "S", 2016, 88, { INT: 2, TKL: 83 }),
      P("Patrick Chung", "S", 2016, 82, { TKL: 84, INT: 1 })
    ]
  },
  {
    team: "MIN",
    era: "2015–2019",
    players: [
      P("Kirk Cousins", "QB", 2019, 86, { YDS: 3603, TD: 26, INT: 6, RTG: 107.4 }),
      P("Adrian Peterson", "RB", 2015, 93, { RUYDS: 1485, TD: 11, YPC: 4.5 }),
      P("Dalvin Cook", "RB", 2019, 88, { RUYDS: 1135, TD: 13, REC: 53 }),
      P("Latavius Murray", "RB", 2017, 80, { RUYDS: 842, TD: 8, YPC: 4.0 }),
      P("Jerick McKinnon", "RB", 2016, 78, { RUYDS: 539, REC: 43, TD: 2 }),
      P("Adam Thielen", "WR", 2018, 89, { REC: 113, YDS: 1373, TD: 9 }),
      P("Stefon Diggs", "WR", 2018, 88, { REC: 102, YDS: 1021, TD: 9 }),
      P("Laquon Treadwell", "WR", 2018, 74, { REC: 35, YDS: 302, TD: 1 }),
      P("Kyle Rudolph", "TE", 2016, 82, { REC: 83, YDS: 840, TD: 7 }),
      P("Danielle Hunter", "EDGE", 2018, 92, { SACKS: 14.5, TKL: 72, FF: 3 }),
      P("Everson Griffen", "EDGE", 2017, 89, { SACKS: 13, TKL: 47, FF: 4 }),
      P("Linval Joseph", "DT", 2016, 87, { TKL: 77, SACKS: 4 }),
      P("Sheldon Richardson", "DT", 2018, 82, { SACKS: 4.5, TKL: 49 }),
      P("Eric Kendricks", "LB", 2019, 89, { TKL: 110, INT: 1, PD: 12 }),
      P("Anthony Barr", "LB", 2015, 85, { TKL: 71, SACKS: 3.5, INT: 1 }),
      P("Xavier Rhodes", "CB", 2017, 89, { INT: 1, PD: 12, TKL: 47 }),
      P("Trae Waynes", "CB", 2018, 80, { INT: 1, PD: 11 }),
      P("Mackensie Alexander", "CB", 2019, 78, { PD: 5, TKL: 43 }),
      P("Harrison Smith", "S", 2017, 93, { INT: 5, TKL: 78, SACKS: 1.5 }),
      P("Anthony Harris", "S", 2019, 87, { INT: 6, TKL: 60 }),
      P("Andrew Sendejo", "S", 2016, 79, { TKL: 87, INT: 2 })
    ]
  },
  {
    team: "LAR",
    era: "2017–2022",
    players: [
      P("Matthew Stafford", "QB", 2021, 89, { YDS: 4886, TD: 41, INT: 17, RTG: 102.9 }),
      P("Jared Goff", "QB", 2018, 85, { YDS: 4688, TD: 32, INT: 12, RTG: 101.1 }),
      P("Todd Gurley", "RB", 2017, 94, { RUYDS: 1305, TD: 19, REC: 64, RECYDS: 788 }),
      P("Cam Akers", "RB", 2020, 79, { RUYDS: 625, TD: 2, YPC: 4.3 }),
      P("Cooper Kupp", "WR", 2021, 97, { REC: 145, YDS: 1947, TD: 16 }),
      P("Brandin Cooks", "WR", 2018, 86, { REC: 80, YDS: 1204, TD: 5 }),
      P("Robert Woods", "WR", 2019, 85, { REC: 90, YDS: 1134, TD: 2 }),
      P("Odell Beckham Jr.", "WR", 2021, 80, { REC: 27, YDS: 305, TD: 5 }),
      P("Tyler Higbee", "TE", 2019, 82, { REC: 69, YDS: 734, TD: 3 }),
      P("Aaron Donald", "DT", 2018, 99, { SACKS: 20.5, TKL: 59, FF: 4 }),
      P("Ndamukong Suh", "DT", 2018, 84, { SACKS: 4.5, TKL: 59 }),
      P("Michael Brockers", "DT", 2018, 80, { SACKS: 3, TKL: 45 }),
      P("Von Miller", "EDGE", 2021, 86, { SACKS: 9.5, TKL: 43 }),
      P("Leonard Floyd", "EDGE", 2021, 85, { SACKS: 9.5, TKL: 78 }),
      P("Bobby Wagner", "LB", 2022, 88, { TKL: 140, SACKS: 6, INT: 2 }),
      P("Cory Littleton", "LB", 2018, 84, { TKL: 125, SACKS: 4, INT: 3 }),
      P("Ernest Jones", "LB", 2022, 81, { TKL: 145, SACKS: 2 }),
      P("Jalen Ramsey", "CB", 2021, 93, { INT: 4, PD: 16, TKL: 77 }),
      P("Marcus Peters", "CB", 2018, 83, { INT: 3, PD: 12 }),
      P("Aqib Talib", "CB", 2018, 83, { INT: 1, PD: 7 }),
      P("John Johnson III", "S", 2018, 84, { TKL: 119, INT: 4 }),
      P("Taylor Rapp", "S", 2021, 80, { INT: 4, TKL: 96 })
    ]
  },
  {
    team: "TB",
    era: "2020–2022",
    players: [
      P("Tom Brady", "QB", 2021, 93, { YDS: 5316, TD: 43, INT: 12, RTG: 102.1 }),
      P("Leonard Fournette", "RB", 2021, 82, { RUYDS: 812, TD: 8, REC: 69 }),
      P("Ronald Jones", "RB", 2020, 79, { RUYDS: 978, TD: 7, YPC: 5.1 }),
      P("Mike Evans", "WR", 2021, 91, { REC: 74, YDS: 1035, TD: 14 }),
      P("Chris Godwin", "WR", 2020, 87, { REC: 65, YDS: 840, TD: 7 }),
      P("Antonio Brown", "WR", 2021, 84, { REC: 42, YDS: 545, TD: 4 }),
      P("Rob Gronkowski", "TE", 2021, 85, { REC: 55, YDS: 802, TD: 6 }),
      P("Cameron Brate", "TE", 2020, 77, { REC: 28, YDS: 282, TD: 2 }),
      P("Shaquil Barrett", "EDGE", 2021, 89, { SACKS: 10, TKL: 44, FF: 4 }),
      P("Jason Pierre-Paul", "EDGE", 2020, 86, { SACKS: 9.5, TKL: 45, FF: 4 }),
      P("Vita Vea", "DT", 2021, 88, { SACKS: 4, TKL: 46 }),
      P("Ndamukong Suh", "DT", 2020, 84, { SACKS: 6, TKL: 46 }),
      P("William Gholston", "DT", 2020, 79, { TKL: 44, SACKS: 1 }),
      P("Devin White", "LB", 2020, 90, { TKL: 140, SACKS: 9, FF: 3 }),
      P("Lavonte David", "LB", 2021, 89, { TKL: 103, SACKS: 3, INT: 1 }),
      P("Carlton Davis", "CB", 2020, 85, { INT: 4, PD: 18 }),
      P("Jamel Dean", "CB", 2022, 83, { INT: 1, PD: 15 }),
      P("Sean Murphy-Bunting", "CB", 2020, 79, { INT: 3, PD: 8 }),
      P("Antoine Winfield Jr.", "S", 2022, 88, { TKL: 122, SACKS: 3, INT: 1 }),
      P("Jordan Whitehead", "S", 2021, 81, { TKL: 76, INT: 1 }),
      P("Mike Edwards", "S", 2021, 79, { INT: 3, TD: 2, TKL: 55 })
    ]
  },
  {
    team: "BAL",
    era: "2019–2023",
    players: [
      P("Lamar Jackson", "QB", 2019, 97, { YDS: 3127, TD: 36, INT: 6, RUYDS: 1206 }),
      P("Mark Ingram", "RB", 2019, 84, { RUYDS: 1018, TD: 10, YPC: 5.0 }),
      P("J.K. Dobbins", "RB", 2020, 83, { RUYDS: 805, TD: 9, YPC: 6.0 }),
      P("Gus Edwards", "RB", 2019, 79, { RUYDS: 711, TD: 2, YPC: 5.3 }),
      P("Mark Andrews", "TE", 2021, 92, { REC: 107, YDS: 1361, TD: 9 }),
      P("Marquise Brown", "WR", 2021, 84, { REC: 91, YDS: 1008, TD: 6 }),
      P("Zay Flowers", "WR", 2023, 82, { REC: 77, YDS: 858, TD: 5 }),
      P("Rashod Bateman", "WR", 2022, 78, { REC: 15, YDS: 285, TD: 2 }),
      P("Matthew Judon", "EDGE", 2019, 85, { SACKS: 9.5, TKL: 54 }),
      P("Odafe Oweh", "EDGE", 2021, 80, { SACKS: 5, TKL: 33, FF: 3 }),
      P("Justin Madubuike", "DT", 2023, 88, { SACKS: 13, TKL: 56 }),
      P("Calais Campbell", "DT", 2020, 84, { SACKS: 4, TKL: 34 }),
      P("Michael Pierce", "DT", 2019, 80, { TKL: 42, SACKS: 1 }),
      P("Roquan Smith", "LB", 2023, 92, { TKL: 158, SACKS: 1.5, INT: 1 }),
      P("Patrick Queen", "LB", 2023, 87, { TKL: 133, SACKS: 3.5, INT: 1 }),
      P("Marlon Humphrey", "CB", 2019, 89, { INT: 3, PD: 14, FF: 2 }),
      P("Marcus Peters", "CB", 2019, 86, { INT: 5, PD: 12, TD: 2 }),
      P("Brandon Stephens", "CB", 2023, 79, { PD: 11, TKL: 78 }),
      P("Kyle Hamilton", "S", 2023, 91, { TKL: 81, INT: 4, SACKS: 3 }),
      P("Earl Thomas", "S", 2019, 85, { INT: 2, TKL: 49 }),
      P("Chuck Clark", "S", 2020, 80, { TKL: 88, INT: 2 })
    ]
  },
  {
    team: "CIN",
    era: "2021–2025",
    players: [
      P("Joe Burrow", "QB", 2022, 92, { YDS: 4475, TD: 35, INT: 12, RTG: 100.8 }),
      P("Joe Mixon", "RB", 2021, 85, { RUYDS: 1205, TD: 13, YPC: 4.1 }),
      P("Chase Brown", "RB", 2024, 82, { RUYDS: 990, TD: 7, YPC: 4.5 }),
      P("Ja'Marr Chase", "WR", 2024, 97, { REC: 127, YDS: 1708, TD: 17 }),
      P("Tee Higgins", "WR", 2022, 88, { REC: 74, YDS: 1029, TD: 7 }),
      P("Tyler Boyd", "WR", 2021, 82, { REC: 67, YDS: 828, TD: 5 }),
      P("Andrei Iosivas", "WR", 2024, 78, { REC: 36, YDS: 479, TD: 6 }),
      P("Mike Gesicki", "TE", 2024, 79, { REC: 65, YDS: 665, TD: 2 }),
      P("Hayden Hurst", "TE", 2022, 78, { REC: 52, YDS: 414, TD: 2 }),
      P("Trey Hendrickson", "EDGE", 2024, 94, { SACKS: 17.5, TKL: 46, FF: 2 }),
      P("Sam Hubbard", "EDGE", 2021, 83, { SACKS: 7.5, TKL: 47 }),
      P("D.J. Reader", "DT", 2021, 85, { TKL: 47, SACKS: 2 }),
      P("B.J. Hill", "DT", 2021, 81, { SACKS: 5.5, TKL: 32 }),
      P("Logan Wilson", "LB", 2022, 86, { TKL: 130, INT: 4 }),
      P("Germaine Pratt", "LB", 2022, 82, { TKL: 99, SACKS: 1 }),
      P("Chidobe Awuzie", "CB", 2021, 83, { INT: 2, PD: 12 }),
      P("Mike Hilton", "CB", 2021, 82, { INT: 3, PD: 9, SACKS: 2 }),
      P("Cam Taylor-Britt", "CB", 2023, 80, { INT: 3, PD: 12 }),
      P("Jessie Bates III", "S", 2021, 87, { INT: 1, TKL: 88, PD: 8 }),
      P("Vonn Bell", "S", 2021, 82, { TKL: 100, INT: 2 }),
      P("Dax Hill", "S", 2023, 78, { TKL: 110, PD: 4 })
    ]
  },
  {
    team: "DET",
    era: "2022–2025",
    players: [
      P("Jared Goff", "QB", 2024, 90, { YDS: 4629, TD: 37, INT: 12, RTG: 111.8 }),
      P("Jahmyr Gibbs", "RB", 2024, 92, { RUYDS: 1412, TD: 16, REC: 52, RECYDS: 517 }),
      P("David Montgomery", "RB", 2023, 84, { RUYDS: 1015, TD: 13, YPC: 4.4 }),
      P("Amon-Ra St. Brown", "WR", 2023, 93, { REC: 119, YDS: 1515, TD: 10 }),
      P("Jameson Williams", "WR", 2024, 83, { REC: 58, YDS: 1001, TD: 7 }),
      P("Josh Reynolds", "WR", 2023, 78, { REC: 40, YDS: 608, TD: 5 }),
      P("Sam LaPorta", "TE", 2023, 87, { REC: 86, YDS: 889, TD: 10 }),
      P("Aidan Hutchinson", "EDGE", 2023, 92, { SACKS: 11.5, TKL: 66, FF: 2 }),
      P("Marcus Davenport", "EDGE", 2024, 78, { SACKS: 2, TKL: 12 }),
      P("Alim McNeill", "DT", 2023, 84, { SACKS: 5, TKL: 44 }),
      P("D.J. Reader", "DT", 2024, 82, { TKL: 40, SACKS: 1 }),
      P("Alex Anzalone", "LB", 2023, 84, { TKL: 129, INT: 2 }),
      P("Jack Campbell", "LB", 2024, 85, { TKL: 116, SACKS: 2, INT: 1 }),
      P("Derrick Barnes", "LB", 2023, 79, { TKL: 60, SACKS: 2 }),
      P("Carlton Davis", "CB", 2024, 83, { INT: 2, PD: 11 }),
      P("Cameron Sutton", "CB", 2023, 79, { INT: 2, PD: 9 }),
      P("Terrion Arnold", "CB", 2024, 79, { PD: 12, TKL: 65 }),
      P("Brian Branch", "S", 2024, 88, { INT: 4, TKL: 109, TD: 1 }),
      P("Kerby Joseph", "S", 2024, 90, { INT: 9, TKL: 76 }),
      P("C.J. Gardner-Johnson", "S", 2023, 84, { INT: 6, TKL: 62 })
    ]
  },
  {
    team: "KC",
    era: "2023–2025",
    players: [
      P("Patrick Mahomes", "QB", 2024, 95, { YDS: 3928, TD: 26, INT: 11, RTG: 93.5 }),
      P("Isiah Pacheco", "RB", 2023, 83, { RUYDS: 935, TD: 7, YPC: 4.3 }),
      P("Kareem Hunt", "RB", 2024, 79, { RUYDS: 728, TD: 7, YPC: 3.6 }),
      P("Travis Kelce", "TE", 2023, 90, { REC: 93, YDS: 984, TD: 5 }),
      P("Rashee Rice", "WR", 2023, 86, { REC: 79, YDS: 938, TD: 7 }),
      P("Xavier Worthy", "WR", 2024, 82, { REC: 59, YDS: 638, TD: 6 }),
      P("DeAndre Hopkins", "WR", 2024, 81, { REC: 41, YDS: 437, TD: 5 }),
      P("Noah Gray", "TE", 2024, 77, { REC: 40, YDS: 437, TD: 5 }),
      P("Chris Jones", "DT", 2023, 96, { SACKS: 10.5, TKL: 30 }),
      P("Tershawn Wharton", "DT", 2024, 80, { SACKS: 6.5, TKL: 34 }),
      P("George Karlaftis", "EDGE", 2023, 86, { SACKS: 10.5, TKL: 42 }),
      P("Charles Omenihu", "EDGE", 2023, 82, { SACKS: 7, TKL: 34 }),
      P("Nick Bolton", "LB", 2024, 87, { TKL: 106, SACKS: 2, INT: 1 }),
      P("Drue Tranquill", "LB", 2023, 82, { TKL: 76, SACKS: 3.5 }),
      P("Leo Chenal", "LB", 2024, 81, { TKL: 68, SACKS: 4 }),
      P("Trent McDuffie", "CB", 2023, 92, { PD: 10, SACKS: 3, FF: 2 }),
      P("L'Jarius Sneed", "CB", 2023, 87, { INT: 1, PD: 14, TKL: 79 }),
      P("Jaylen Watson", "CB", 2023, 79, { INT: 1, PD: 8 }),
      P("Justin Reid", "S", 2023, 83, { TKL: 72, INT: 1, SACKS: 2 }),
      P("Bryan Cook", "S", 2024, 79, { TKL: 60, PD: 4 }),
      P("Chamarri Conner", "S", 2024, 77, { TKL: 55, SACKS: 1 })
    ]
  }
];

// ── Roster shape ────────────────────────────────────────────────

const SLOT_DEFS = [
  { id: "QB", label: "QB", side: "OFF", accepts: ["QB"], mult: 1.5 },
  { id: "RB", label: "RB", side: "OFF", accepts: ["RB"], mult: 1 },
  { id: "WR", label: "WR", side: "OFF", accepts: ["WR"], mult: 1 },
  { id: "TE", label: "TE", side: "OFF", accepts: ["TE"], mult: 1 },
  { id: "FLEX1", label: "FLEX", side: "OFF", accepts: ["RB", "WR", "TE"], mult: 1 },
  { id: "FLEX2", label: "FLEX", side: "OFF", accepts: ["RB", "WR", "TE"], mult: 1 },
  { id: "EDGE", label: "EDGE", side: "DEF", accepts: ["EDGE"], mult: 1.2 },
  { id: "DT", label: "DT", side: "DEF", accepts: ["DT"], mult: 1 },
  { id: "LB", label: "LB", side: "DEF", accepts: ["LB"], mult: 1 },
  { id: "CB", label: "CB", side: "DEF", accepts: ["CB"], mult: 1.2 },
  { id: "S", label: "S", side: "DEF", accepts: ["S"], mult: 1 },
  { id: "DFLEX", label: "D-FLEX", side: "DEF", accepts: ["EDGE", "DT", "LB", "CB", "S"], mult: 1 }
];

const ROUNDS = 12;
const REROLLS = 2;
const SIMS = 25000;

const OPPONENTS = [
  { name: "'03 Panthers", rating: 87 },
  { name: "'70 Colts", rating: 87 },
  { name: "'11 Giants", rating: 88 },
  { name: "'01 Patriots", rating: 88 },
  { name: "'21 Bengals", rating: 88 },
  { name: "'80 Raiders", rating: 88 },
  { name: "'18 Rams", rating: 89 },
  { name: "'82 Redskins", rating: 89 },
  { name: "'99 Titans", rating: 89 },
  { name: "'17 Eagles", rating: 90 },
  { name: "'92 Redskins", rating: 90 },
  { name: "'21 Rams", rating: 90 },
  { name: "'12 Broncos", rating: 90 },
  { name: "'05 Steelers", rating: 90 },
  { name: "'09 Saints", rating: 90 },
  { name: "'15 Panthers", rating: 91 },
  { name: "'06 Colts", rating: 91 },
  { name: "'08 Steelers", rating: 91 },
  { name: "'10 Packers", rating: 91 },
  { name: "'86 Giants", rating: 92 },
  { name: "'19 Ravens", rating: 92 },
  { name: "'23 49ers", rating: 92 },
  { name: "'90 Giants", rating: 92 },
  { name: "'88 49ers", rating: 92 },
  { name: "'14 Patriots", rating: 92 },
  { name: "'24 Eagles", rating: 92 },
  { name: "'96 Packers", rating: 93 },
  { name: "'98 Broncos", rating: 93 },
  { name: "'99 Rams", rating: 93 },
  { name: "'77 Cowboys", rating: 93 },
  { name: "'16 Patriots", rating: 93 },
  { name: "'13 Seahawks", rating: 94 },
  { name: "'00 Ravens", rating: 94 },
  { name: "'20 Chiefs", rating: 94 },
  { name: "'94 49ers", rating: 94 },
  { name: "'02 Buccaneers", rating: 94 },
  { name: "'75 Steelers", rating: 95 },
  { name: "'89 49ers", rating: 95 },
  { name: "'78 Steelers", rating: 95 },
  { name: "'91 Redskins", rating: 95 },
  { name: "'93 Cowboys", rating: 95 },
  { name: "'07 Patriots", rating: 96 },
  { name: "'72 Dolphins", rating: 96 },
  { name: "'84 49ers", rating: 96 },
  { name: "'85 Bears", rating: 97 }
];

// ── Helpers ─────────────────────────────────────────────────────

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSchedule() {
  // 17 random regular-season games, then 3 playoff monsters. Both stretches
  // run easy→hard: the odds of 20-0 are a product of per-game probabilities,
  // so ordering doesn't change them — but runs build momentum instead of
  // dying to a week-2 buzzsaw, and the toughest boss waits at the end.
  const pool = shuffle(OPPONENTS);
  const regular = pool.slice(0, 17).sort((a, b) => a.rating - b.rating);
  const playoffs = shuffle(OPPONENTS.filter((o) => o.rating >= 94))
    .slice(0, 3)
    .sort((a, b) => a.rating - b.rating);
  return regular.concat(playoffs).map((o, i) => ({ ...o, week: i + 1, playoff: i >= 17 }));
}

function roundSide(round) {
  return round <= 6 ? "OFF" : "DEF";
}

function eligibleSlots(roster, player) {
  if (!player) return [];
  return SLOT_DEFS.filter(
    (slot) => !roster[slot.id] && slot.accepts.includes(player.pos)
  ).map((s) => s.id);
}

function sidePlayers(pool, side) {
  const allowed = side === "OFF" ? OFF_POS : DEF_POS;
  return pool.players.filter((p) => allowed.has(p.pos));
}

// A round's pool must contain at least one placeable player; rescue from the
// same side league-wide if the spun team-era can't cover the open slots.
function rollRound(roster, side) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
    const players = sidePlayers(pool, side);
    if (players.some((p) => eligibleSlots(roster, p).length > 0)) {
      return { team: pool.team, era: pool.era, players: shuffle(players).slice(0, 8) };
    }
  }
  const everyone = shuffle(
    POOLS.flatMap((pool) =>
      sidePlayers(pool, side).map((p) => ({ ...p, team: pool.team, era: pool.era }))
    )
  );
  const rescue = everyone.filter((p) => eligibleSlots(roster, p).length > 0).slice(0, 8);
  return { team: "NFL", era: "All-time", players: rescue };
}

// ── Rating model ────────────────────────────────────────────────
// A championship roster has no weak links: the algorithm should cap your
// team at its softest starter, not average a hole away. So the team score
// blends balanced strength (weighted mean) with your weakest starter.
const WEAKEST_LINK_WEIGHT = 0.32; // how hard a soft spot drags you down
const HOME_EDGE = 1.5;            // "your squad" gets a small edge each game
const SIGMA_GAME = 6.5;           // single-game "any given Sunday" swing
const SIGMA_FORM = 3.2;           // talent uncertainty — a run's true level
// Combined spread of the (you − them) matchup margin, folding in both the
// per-game noise on each side and the season-form uncertainty.
const SD_MATCH = Math.sqrt(SIGMA_FORM * SIGMA_FORM + 2 * SIGMA_GAME * SIGMA_GAME);

function teamProfile(roster) {
  const ratings = [];
  let total = 0;
  let weight = 0;
  for (const slot of SLOT_DEFS) {
    const p = roster[slot.id];
    if (p) {
      total += p.rating * slot.mult;
      weight += slot.mult;
      ratings.push(p.rating);
    }
  }
  const mean = weight ? total / weight : 0;
  const weakest = ratings.length ? Math.min(...ratings) : 0;
  const strongest = ratings.length ? Math.max(...ratings) : 0;
  const score = mean * (1 - WEAKEST_LINK_WEIGHT) + weakest * WEAKEST_LINK_WEIGHT;
  return { score, mean, weakest, strongest, spread: mean - weakest, filled: ratings.length };
}

function teamScore(roster) {
  return teamProfile(roster).score;
}

// Standard-normal CDF (Abramowitz & Stegun 26.2.17) — good to ~1e-7.
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Marginal single-game win probability: P(you beat this opponent) once, before
// the season — the honest number a bettor would quote. A probit matchup model
// over the combined margin spread.
function winProbability(score, oppRating) {
  return normCdf((score + HOME_EDGE - oppRating) / SD_MATCH);
}

// Box-Muller standard normal for the simulation's performance draws.
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Monte Carlo: SIMS sudden-death runs. Each run first draws the squad's TRUE
// level for that run (SIGMA_FORM) — talent is uncertain, so even an all-time
// roster regresses; some runs you show up a juggernaut, some you're merely
// great. Then every game adds independent "any given Sunday" noise to both
// sides. A run ends at the first loss, exactly like the live season, so the
// distribution is the game you're about to play — not a naive product of
// fixed probabilities.
function runMonteCarlo(score, schedule) {
  const n = schedule.length;
  const bins = new Array(n + 1).fill(0);
  const runLengths = new Array(SIMS);
  let totalWins = 0;

  for (let s = 0; s < SIMS; s++) {
    const form = score + SIGMA_FORM * gauss(); // this run's true level
    let wins = 0;
    for (let g = 0; g < n; g++) {
      const you = form + HOME_EDGE + SIGMA_GAME * gauss();
      const them = schedule[g].rating + SIGMA_GAME * gauss();
      if (you <= them) break;
      wins++;
    }
    bins[wins]++;
    runLengths[s] = wins;
    totalWins += wins;
  }

  runLengths.sort((a, b) => a - b);
  const pct = (q) => runLengths[Math.min(SIMS - 1, Math.floor(SIMS * q))];

  // Marginal per-game odds + the gauntlet's single hardest game.
  const gameProbs = schedule.map((g) => winProbability(score, g.rating));
  let hardest = 0;
  for (let i = 1; i < gameProbs.length; i++) {
    if (gameProbs[i] < gameProbs[hardest]) hardest = i;
  }

  // Odds ladder: milestones fans actually talk about.
  const atLeast = (w) => {
    let c = 0;
    for (let i = w; i <= n; i++) c += bins[i];
    return c / SIMS;
  };

  return {
    bins,
    sims: SIMS,
    meanWins: totalWins / SIMS,
    medianWins: pct(0.5),
    ceilingWins: pct(0.95), // a realistic great run
    pPerfect: bins[n] / SIMS,
    pUnbeatenReg: atLeast(17), // 17-0 into the playoffs (the '72 Dolphins line)
    pReachSB: atLeast(19), // 19-0, one win from immortality (the '07 Pats line)
    gameProbs,
    hardestIndex: hardest,
    hardestProb: gameProbs[hardest]
  };
}

function oneInLabel(p) {
  if (!p || p <= 0) return `< 1 in ${SIMS.toLocaleString("en-US")}`;
  return `1 in ${Math.max(1, Math.round(1 / p)).toLocaleString("en-US")}`;
}

function balanceGrade(spread) {
  if (spread < 3) return { grade: "A+", label: "no weak links" };
  if (spread < 5) return { grade: "A", label: "elite everywhere" };
  if (spread < 8) return { grade: "B", label: "one soft spot" };
  if (spread < 12) return { grade: "C", label: "exploitable hole" };
  return { grade: "D", label: "glaring weakness" };
}

function statCols(player) {
  return Object.entries(player.stats).slice(0, 5);
}

// ── Component ───────────────────────────────────────────────────

export default function PerfectSeason({ onReward }) {
  const [phase, setPhase] = useState("idle"); // idle | spin | draft | engine | season | done
  const [round, setRound] = useState(1);
  const [roundPool, setRoundPool] = useState(null); // { team, era, players }
  const [spinLabel, setSpinLabel] = useState({ team: "DAL", era: "1991–1995" });
  const [roster, setRoster] = useState({});
  const [selected, setSelected] = useState(null);
  const [rerolls, setRerolls] = useState(REROLLS);
  const [sortBy, setSortBy] = useState("pos");
  const [filterPos, setFilterPos] = useState("All");
  const [schedule, setSchedule] = useState([]);
  const [mc, setMc] = useState(null); // Monte Carlo result
  const [gameIndex, setGameIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [stamp, setStamp] = useState(null);
  const [reward, setReward] = useState(null);
  const [spinSettled, setSpinSettled] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (phase !== "spin" || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  const wins = results.filter((r) => r === "W").length;
  const losses = results.filter((r) => r === "L").length;
  const profile = teamProfile(roster);
  const score = profile.score;
  const highlight = new Set(eligibleSlots(roster, selected));

  const displayPool = useMemo(() => {
    if (!roundPool) return [];
    let list = [...roundPool.players];
    if (filterPos !== "All") list = list.filter((p) => p.pos === filterPos);
    if (sortBy === "year") list.sort((a, b) => a.year - b.year);
    else list.sort((a, b) => a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name));
    return list;
  }, [roundPool, sortBy, filterPos]);

  const poolPositions = useMemo(() => {
    if (!roundPool) return [];
    return [...new Set(roundPool.players.map((p) => p.pos))];
  }, [roundPool]);

  function spinRound(nextRoster, nextRound) {
    setPhase("spin");
    setSelected(null);
    setFilterPos("All");
    setSpinSettled(false);
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      const random = POOLS[Math.floor(Math.random() * POOLS.length)];
      setSpinLabel({ team: random.team, era: random.era });
      if (ticks >= 22) {
        clearInterval(interval);
        const rolled = rollRound(nextRoster, roundSide(nextRound));
        setSpinLabel({ team: rolled.team, era: rolled.era });
        setSpinSettled(true);
        later(() => {
          setRoundPool(rolled);
          setPhase("draft");
          setSpinSettled(false);
        }, 850);
      }
    }, 70);
    timers.current.push(interval);
  }

  function startDraft() {
    setRoster({});
    setResults([]);
    setGameIndex(0);
    setStamp(null);
    setReward(null);
    setMc(null);
    setRerolls(REROLLS);
    setRound(1);
    spinRound({}, 1);
  }

  function reroll() {
    if (rerolls < 1) return;
    setRerolls(rerolls - 1);
    spinRound(roster, round);
  }

  function place(slotId) {
    if (!selected || !highlight.has(slotId)) return;
    const next = { ...roster, [slotId]: selected };
    setRoster(next);
    setSelected(null);
    if (round >= ROUNDS) {
      const sched = buildSchedule();
      setSchedule(sched);
      setPhase("engine");
      later(() => setMc(runMonteCarlo(teamScore(next), sched)), 500);
    } else {
      const nextRound = round + 1;
      setRound(nextRound);
      spinRound(next, nextRound);
    }
  }

  function playSeason() {
    setResults([]);
    setGameIndex(0);
    setStamp(null);
    setPhase("season");
    // Draw this run's true level once (same generative model as the sim),
    // so the live season is a fair sample from the odds you were just shown.
    const form = score + SIGMA_FORM * gauss();
    playGame(schedule, 0, [], form);
  }

  function playGame(sched, index, resultsSoFar, form) {
    setGameIndex(index);
    setStamp(null);
    later(() => {
      const you = form + HOME_EDGE + SIGMA_GAME * gauss();
      const them = sched[index].rating + SIGMA_GAME * gauss();
      const won = you > them;
      const outcome = won ? "W" : "L";
      const nextResults = [...resultsSoFar, outcome];
      setStamp(outcome);
      setResults(nextResults);
      later(() => {
        if (!won || index + 1 >= sched.length) setPhase("done");
        else playGame(sched, index + 1, nextResults, form);
      }, 1250);
    }, 950);
  }

  useEffect(() => {
    if (phase !== "done" || reward !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.claimSeasonReward(wins);
        if (!cancelled) {
          setReward(data);
          if (onReward && data && typeof data.balance === "number") onReward(data.balance);
        }
      } catch (_err) {
        if (!cancelled) setReward({ ok: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const perfect = phase === "done" && losses === 0 && wins === schedule.length;
  const currentGame = schedule[gameIndex];
  const maxBin = mc ? Math.max(...mc.bins) : 1;
  const gradeInfo = balanceGrade(profile.spread);
  const hardestGame = mc ? schedule[mc.hardestIndex] : null;
  const spinTakeover =
    phase === "spin" && typeof document !== "undefined"
      ? createPortal(
          <div className={`ps2-takeover ${spinSettled ? "is-locked" : "is-spinning"}`}>
            <div className="ps2-takeover__field" aria-hidden="true">
              {SLOT_DEFS.map((slot) => (
                <span key={slot.id}>
                  {slot.label}
                </span>
              ))}
            </div>
            <div className="ps2-takeover__panel" aria-live="polite">
              <div className="ps2-takeover__round">
                Round {round}/{ROUNDS} · {roundSide(round) === "OFF" ? "Offense" : "Defense"}
              </div>
              <div className="ps2-takeover__reels">
                <div className="ps2-takeover__reel ps2-takeover__reel--team">
                  <em>Team</em>
                  <strong>{spinLabel.team}</strong>
                </div>
                <div className="ps2-takeover__reel ps2-takeover__reel--era">
                  <em>Era</em>
                  <strong>{spinLabel.era}</strong>
                </div>
              </div>
              <div className="ps2-takeover__status">
                {spinSettled ? "Let's go" : "Spinning"}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  // ── Render ────────────────────────────────────────────────────

  const rosterTray = (
    <div className="ps2-tray">
      {["DEF", "OFF"].map((side) => (
        <div className="ps2-tray__row" key={side}>
          <span className="ps2-tray__side">{side}</span>
          {SLOT_DEFS.filter((s) => s.side === side).map((slot) => {
            const filled = roster[slot.id];
            const hot = highlight.has(slot.id);
            return (
              <button
                key={slot.id}
                className={`ps2-slot ${filled ? "is-filled" : ""} ${hot ? "is-hot" : ""}`}
                onClick={() => place(slot.id)}
                disabled={!hot}
              >
                <span className="ps2-slot__label">
                  {filled ? filled.pos : slot.label}
                  {slot.mult !== 1 ? <em>×{slot.mult}</em> : null}
                </span>
                <span className="ps2-slot__name">
                  {filled ? filled.name : "—"}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="ps">
      {spinTakeover}
      {phase === "idle" ? (
        <div className="ps-splash ps-pop">
          <div className="ps-kicker">Game mode · powered by the Quantum Engine</div>
          <h2 className="ps-hero">
            Can you go
            <span className="ps-hero__num">20<i>–</i>0</span>
            <span className="ps-hero__q">?</span>
          </h2>
          <p className="ps-copy">
            Draft an all-time roster one spin at a time, then let the engine run
            it through {SIMS.toLocaleString("en-US")} sudden-death seasons — and
            play the real one. Lose once and the dream is over.
          </p>

          <div className="ps-how">
            <div className="ps-how__tile">
              <span className="ps-how__num">12</span>
              <span className="ps-how__label">rounds · spin a team &amp; era, draft one player</span>
            </div>
            <div className="ps-how__tile">
              <span className="ps-how__num">{(SIMS / 1000).toFixed(0)}k</span>
              <span className="ps-how__label">Monte Carlo seasons before you play</span>
            </div>
            <div className="ps-how__tile">
              <span className="ps-how__num">20–0</span>
              <span className="ps-how__label">17 games, then 3 playoff monsters</span>
            </div>
          </div>

          <button className="wr-btn ps-cta" onClick={startDraft}>
            Start the draft
          </button>
          <p className="ps-splash__foot">
            No weak links allowed — every win pays Star Coins, with milestone
            bonuses along the way.
          </p>
        </div>
      ) : null}

      {phase === "draft" ? (
        <div className="ps2-draft">
          <div className="ps2-head">
            <span className="ps2-round">
              Round <strong>{round}</strong>
              <em>/{ROUNDS}</em>
            </span>
            <span className={`ps2-side ps2-side--${roundSide(round).toLowerCase()}`}>
              {roundSide(round)}
            </span>
            <span
              className={`ps2-chip ps2-chip--team ${
                phase === "spin" ? (spinSettled ? "is-locked" : "is-spinning") : ""
              }`}
            >
              <em>Team</em>
              <span className="ps2-chip__value">{spinLabel.team}</span>
            </span>
            <span
              className={`ps2-chip ps2-chip--era ${
                phase === "spin" ? (spinSettled ? "is-locked" : "is-spinning") : ""
              }`}
            >
              <em>Era</em>
              <span className="ps2-chip__value">{spinLabel.era}</span>
            </span>
            <button
              className="ps-skip"
              onClick={reroll}
              disabled={rerolls < 1 || phase === "spin"}
            >
              Reroll · {rerolls}
            </button>
          </div>
          <div className="ps2-hint">
            {selected
              ? `Tap a highlighted slot to place ${selected.name}.`
              : "Select a player, then tap a highlighted position."}
          </div>

          {phase === "draft" && roundPool ? (
            <>
              <div className="ps2-controls">
                <label className="ps2-sort">
                  Sort
	                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
	                    <option value="pos">Position</option>
	                    <option value="year">Year</option>
	                  </select>
                </label>
                <div className="ps2-filters">
                  {["All", ...poolPositions].map((pos) => (
                    <button
                      key={pos}
                      className={`ps2-filter ${filterPos === pos ? "is-active" : ""}`}
                      onClick={() => setFilterPos(pos)}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ps2-pool">
                {displayPool.map((p, i) => {
                  const canPlace = eligibleSlots(roster, p).length > 0;
                  const isSel = selected && selected.name === p.name && selected.year === p.year;
                  return (
                    <button
                      key={`${p.name}-${p.year}`}
                      className={`ps2-row ${isSel ? "is-selected" : ""} ${
                        !canPlace ? "is-blocked" : ""
                      }`}
                      style={{ animationDelay: `${i * 45}ms` }}
                      onClick={() => canPlace && setSelected(isSel ? null : p)}
                      disabled={!canPlace}
                    >
                      <span className="ps2-row__pos">{p.pos}</span>
                      <span className="ps2-row__who">
                        <span className="ps2-row__name">{p.name}</span>
                        <span className="ps2-row__meta">
                          {roundPool.team} · {p.year}
                          {!canPlace ? " · no open slot" : ""}
                        </span>
                      </span>
                      <span className="ps2-row__stats">
                        {statCols(p).map(([k, v]) => (
                          <span className="ps2-stat" key={k}>
                            <strong>{v}</strong>
                            <em>{k}</em>
                          </span>
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="ps2-spinwait">Scouting the league…</div>
          )}

          {rosterTray}
        </div>
      ) : null}

      {phase === "engine" ? (
        <div className="ps2-engine ps-pop">
          <div className="ps-kicker">Quantum Engine · Monte Carlo</div>
          <h3 className="ps-subhead">
            {mc
              ? `${SIMS.toLocaleString("en-US")} seasons, simulated.`
              : `Simulating ${SIMS.toLocaleString("en-US")} seasons…`}
          </h3>
          {mc ? (
            <>
              <div className="ps2-engine__tiles">
                <div className="ps2-etile">
                  <span className="ps2-etile__label">Team score</span>
                  <span className="ps2-etile__value">{score.toFixed(1)}</span>
                </div>
                <div className="ps2-etile">
                  <span className="ps2-etile__label">
                    Roster balance
                    <em> · {gradeInfo.label}</em>
                  </span>
                  <span className="ps2-etile__value">{gradeInfo.grade}</span>
                </div>
                <div className="ps2-etile">
                  <span className="ps2-etile__label">Expected run</span>
                  <span className="ps2-etile__value">
                    {mc.meanWins.toFixed(1)}
                    <em> · median {mc.medianWins}</em>
                  </span>
                </div>
                <div className="ps2-etile ps2-etile--hero">
                  <span className="ps2-etile__label">Odds of 20-0</span>
                  <span className="ps2-etile__value">{oneInLabel(mc.pPerfect)}</span>
                </div>
              </div>

              <div className="ps2-ladder" role="table" aria-label="Milestone odds">
                <div className="ps2-ladder__row" role="row">
                  <span className="ps2-ladder__name">Unbeaten regular season · 17-0</span>
                  <span className="ps2-ladder__bar">
                    <span style={{ width: `${Math.min(100, mc.pUnbeatenReg * 100)}%` }} />
                  </span>
                  <span className="ps2-ladder__val">
                    {(mc.pUnbeatenReg * 100).toFixed(mc.pUnbeatenReg < 0.1 ? 2 : 1)}%
                  </span>
                </div>
                <div className="ps2-ladder__row" role="row">
                  <span className="ps2-ladder__name">Reach the Super Bowl · 19-0</span>
                  <span className="ps2-ladder__bar">
                    <span style={{ width: `${Math.min(100, mc.pReachSB * 100 * 6)}%` }} />
                  </span>
                  <span className="ps2-ladder__val">
                    {(mc.pReachSB * 100).toFixed(mc.pReachSB < 0.1 ? 2 : 1)}%
                  </span>
                </div>
                <div className="ps2-ladder__row is-crown" role="row">
                  <span className="ps2-ladder__name">Immortality · 20-0</span>
                  <span className="ps2-ladder__bar">
                    <span style={{ width: `${Math.min(100, mc.pPerfect * 100 * 20)}%` }} />
                  </span>
                  <span className="ps2-ladder__val">{oneInLabel(mc.pPerfect)}</span>
                </div>
              </div>

              {hardestGame ? (
                <div className="ps2-gauntlet">
                  <span className="ps2-gauntlet__label">Toughest game on the slate</span>
                  <span className="ps2-gauntlet__name">
                    {hardestGame.playoff ? "Playoffs · " : `Week ${hardestGame.week} · `}
                    {hardestGame.name}
                  </span>
                  <span className="ps2-gauntlet__odds">
                    {Math.round(mc.hardestProb * 100)}% to survive it
                  </span>
                </div>
              ) : null}

              <div className="ps2-hist" role="img" aria-label={`Run length across ${SIMS.toLocaleString("en-US")} simulated sudden-death seasons`}>
                {mc.bins.map((count, w) => (
                  <div className="ps2-hist__col" key={w}>
                    <div
                      className={`ps2-hist__bar ${w === 20 ? "is-perfect" : ""}`}
                      style={{
                        height: `${Math.max(2, (count / maxBin) * 100)}%`,
                        animationDelay: `${w * 35}ms`
                      }}
                      title={`${w} wins: ${((count / SIMS) * 100).toFixed(1)}%`}
                    />
                    {w % 5 === 0 || w === 20 ? (
                      <span className="ps2-hist__tick">{w}</span>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="ps2-hist__caption">
                Wins before each simulated run ended · realistic ceiling {mc.ceilingWins} wins ·
                the red bar is immortality
              </div>
              <button className="wr-btn ps-cta" onClick={playSeason}>
                Play your season
              </button>
            </>
          ) : (
            <div className="ps2-simload">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      ) : null}

      {phase === "season" && currentGame ? (
        <div className="ps-season">
          <div className="ps-scoreline">
            <span className="ps-kicker">
              {currentGame.playoff ? "Playoffs" : `Week ${currentGame.week}`}
              {" · engine gives you "}
              {Math.round(winProbability(score, currentGame.rating) * 100)}%
            </span>
            <span className="ps-record">
              {wins}–{losses}
            </span>
          </div>
          <div className="ps-matchup ps-pop" key={gameIndex}>
            <div className="ps-matchup__side">
              <span className="ps-matchup__team">Your Squad</span>
              <span className="ps-matchup__rating">{score.toFixed(0)}</span>
            </div>
            <span className="ps-matchup__vs">vs</span>
            <div className="ps-matchup__side">
              <span className="ps-matchup__team">{currentGame.name}</span>
              <span className="ps-matchup__rating">{currentGame.rating}</span>
            </div>
            {stamp ? (
              <span className={`ps-stamp ${stamp === "W" ? "ps-stamp--w" : "ps-stamp--l"}`}>
                {stamp === "W" ? "WIN" : "LOSS"}
              </span>
            ) : (
              <span className="ps-matchup__dots">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
          <div className="ps-strip">
            {schedule.map((g, i) => (
              <span
                key={i}
                className={`ps-strip__dot ${
                  results[i] === "W" ? "is-w" : results[i] === "L" ? "is-l" : ""
                } ${i === gameIndex ? "is-now" : ""}`}
                title={g.name}
              />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className={`ps-final ps-pop ${losses ? "ps-final--loss" : "ps-final--perfect"}`}>
          {perfect ? (
            <div className="ps-confetti" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span
                  key={i}
                  style={{ left: `${(i * 137) % 100}%`, animationDelay: `${(i % 9) * 0.18}s` }}
                />
              ))}
            </div>
          ) : null}
          <div className="ps-kicker">{perfect ? "Immortality" : "Final"}</div>
          <h2 className="ps-headline">
            <span className="ps-score">
              {wins}–{losses}
            </span>
          </h2>
          <p className="ps-copy">
            {perfect
              ? `A perfect season — the engine had it at ${
                  mc ? oneInLabel(mc.pPerfect) : "longer than 1 in 25,000"
                }. Canton is calling.`
              : losses
              ? `${schedule[gameIndex] ? schedule[gameIndex].name : "The football gods"} ended the dream${
                  wins > 0 ? ` at ${wins}–0` : ""
                }. The engine expected ${mc ? mc.meanWins.toFixed(1) : "—"} wins — run it back.`
              : "Season complete."}
          </p>
          <div className="ps-reward">
            {reward && reward.ok !== false ? (
              <>
                +{reward.reward} Star Coins
                {perfect
                  ? " · perfect-season bonus included"
                  : reward.milestones && reward.milestones.length
                  ? ` · ${reward.milestones.length === 1 ? "milestone bonus" : "milestone bonuses"} included`
                  : ""}
              </>
            ) : reward ? (
              "Reward unavailable right now — coins next time."
            ) : (
              "Counting your winnings…"
            )}
          </div>
          <button className="wr-btn ps-cta" onClick={startDraft}>
            Run it back
          </button>
        </div>
      ) : null}
    </div>
  );
}
