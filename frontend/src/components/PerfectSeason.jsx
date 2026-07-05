import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

/*
 * Perfect Season — the War Room's second game mode, inspired by 82-0.com's
 * 20-0 challenge, rebuilt in depth:
 *
 *   · 12-round draft. Each round spins a TEAM + ERA window and deals that
 *     team-era's player pool with (approximate) real season stat lines.
 *   · Rounds 1-6 draft offense (QB/RB/WR/TE + 2 FLEX), rounds 7-12 draft
 *     defense (EDGE/DT/LB/CB/S + D-FLEX). Premium slots carry multipliers:
 *     QB x1.5, EDGE x1.2, CB x1.2.
 *   · Select a player, then tap a highlighted slot to place them. Sort and
 *     filter the pool; 2 rerolls per draft.
 *   · The Quantum Engine runs a 10,000-season Monte Carlo on the finished
 *     roster — win distribution, expected wins, and the odds of 20-0 —
 *     before the live season plays out one reveal at a time.
 *   · Wins pay Star Coins into the same wallet as the markets.
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
      P("DeMarvion Overshown", "LB", 2024, 84, { TKL: 90, SACKS: 5 })
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
      P("Jeff Heath", "S", 2017, 79, { INT: 3, TKL: 66 })
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
      P("James Washington", "S", 1994, 83, { TKL: 90, INT: 2 })
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
      P("Reed Blankenship", "S", 2023, 82, { INT: 3, TKL: 106 })
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
      P("Michael Lewis", "S", 2004, 83, { TKL: 88, INT: 1 })
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
      P("Tyrann Mathieu", "S", 2016, 87, { INT: 1, TKL: 68 })
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
      P("Juan Thornhill", "S", 2019, 82, { INT: 3, TKL: 58 })
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
      P("Patrick Chung", "S", 2010, 82, { TKL: 96, INT: 3 })
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
      P("Eugene Wilson", "S", 2003, 81, { INT: 4, TKL: 69 })
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
      P("Carlton Williamson", "S", 1984, 82, { INT: 4, TKL: 60 })
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
      P("Jimmie Ward", "S", 2021, 84, { INT: 2, TKL: 68 })
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
      P("Todd Bell", "S", 1984, 83, { INT: 4, TKL: 86 })
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
      P("Glen Edwards", "S", 1974, 82, { INT: 5, TKL: 55 })
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
      P("Gary Baxter", "CB", 2003, 80, { PD: 12, TKL: 63 })
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
      P("Kim Herring", "S", 2001, 78, { INT: 3, TKL: 60 })
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
      P("Mike Doss", "S", 2004, 78, { TKL: 71, INT: 2 })
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
      P("Byron Maxwell", "CB", 2014, 81, { INT: 2, PD: 12 })
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
      P("Eugene Robinson", "S", 1996, 84, { INT: 6, TKL: 78 })
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
      P("Ron Rice", "S", 1997, 78, { TKL: 81, INT: 2 })
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
      P("Terry Kinard", "S", 1986, 82, { INT: 4, TKL: 70 })
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
      P("Robert Griffith", "S", 1998, 84, { TKL: 100, INT: 3 })
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
      P("Tyrone Braxton", "S", 1997, 84, { INT: 9, TKL: 70 })
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
      P("Damar Hamlin", "S", 2022, 78, { TKL: 91 })
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
const SIMS = 10000;

const OPPONENTS = [
  { name: "'03 Panthers", rating: 87 },
  { name: "'11 Giants", rating: 88 },
  { name: "'17 Eagles", rating: 90 },
  { name: "'92 Redskins", rating: 90 },
  { name: "'21 Rams", rating: 90 },
  { name: "'12 Broncos", rating: 90 },
  { name: "'15 Panthers", rating: 91 },
  { name: "'06 Colts", rating: 91 },
  { name: "'08 Steelers", rating: 91 },
  { name: "'86 Giants", rating: 92 },
  { name: "'19 Ravens", rating: 92 },
  { name: "'23 49ers", rating: 92 },
  { name: "'96 Packers", rating: 93 },
  { name: "'98 Broncos", rating: 93 },
  { name: "'99 Rams", rating: 93 },
  { name: "'13 Seahawks", rating: 94 },
  { name: "'00 Ravens", rating: 94 },
  { name: "'20 Chiefs", rating: 94 },
  { name: "'75 Steelers", rating: 95 },
  { name: "'89 49ers", rating: 95 },
  { name: "'07 Patriots", rating: 96 },
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
  const pool = shuffle(OPPONENTS);
  const regular = pool.slice(0, 17).sort((x, y) => x.rating - y.rating);
  const playoffs = shuffle(OPPONENTS.filter((o) => o.rating >= 94)).slice(0, 3);
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

function teamScore(roster) {
  let total = 0;
  let weight = 0;
  for (const slot of SLOT_DEFS) {
    const p = roster[slot.id];
    if (p) {
      total += p.rating * slot.mult;
      weight += slot.mult;
    }
  }
  return weight ? total / weight : 0;
}

function winProbability(score, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - (score + 1.5)) / 10));
}

// Monte Carlo: SIMS full seasons over the same schedule shape.
function runMonteCarlo(score, schedule) {
  const bins = new Array(schedule.length + 1).fill(0);
  let totalWins = 0;
  const probs = schedule.map((g) => winProbability(score, g.rating));
  for (let s = 0; s < SIMS; s++) {
    let wins = 0;
    for (let g = 0; g < probs.length; g++) {
      if (Math.random() < probs[g]) wins++;
    }
    bins[wins]++;
    totalWins += wins;
  }
  return {
    bins,
    meanWins: totalWins / SIMS,
    pPerfect: bins[schedule.length] / SIMS
  };
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
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  const wins = results.filter((r) => r === "W").length;
  const losses = results.filter((r) => r === "L").length;
  const score = teamScore(roster);
  const highlight = new Set(eligibleSlots(roster, selected));

  const displayPool = useMemo(() => {
    if (!roundPool) return [];
    let list = [...roundPool.players];
    if (filterPos !== "All") list = list.filter((p) => p.pos === filterPos);
    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "year") list.sort((a, b) => a.year - b.year);
    else list.sort((a, b) => a.pos.localeCompare(b.pos) || b.rating - a.rating);
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
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      const random = POOLS[Math.floor(Math.random() * POOLS.length)];
      setSpinLabel({ team: random.team, era: random.era });
      if (ticks >= 10) {
        clearInterval(interval);
        const rolled = rollRound(nextRoster, roundSide(nextRound));
        setSpinLabel({ team: rolled.team, era: rolled.era });
        later(() => {
          setRoundPool(rolled);
          setPhase("draft");
        }, 320);
      }
    }, 85);
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
    playGame(schedule, 0, [], score);
  }

  function playGame(sched, index, resultsSoFar, teamSc) {
    setGameIndex(index);
    setStamp(null);
    later(() => {
      const won = Math.random() < winProbability(teamSc, sched[index].rating);
      const outcome = won ? "W" : "L";
      const nextResults = [...resultsSoFar, outcome];
      setStamp(outcome);
      setResults(nextResults);
      later(() => {
        if (!won || index + 1 >= sched.length) setPhase("done");
        else playGame(sched, index + 1, nextResults, teamSc);
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
      {phase === "idle" ? (
        <div className="ps-splash ps-pop">
          <div className="ps-kicker">Game mode · powered by the Quantum Engine</div>
          <h2 className="ps-headline">
            Can you go <span className="ps-score">20–0</span>?
          </h2>
          <p className="ps-copy">
            Twelve rounds. Each spin reveals an NFL team and era — draft one
            player per round into a full two-way roster. Premium slots pay
            premium weight (QB ×1.5, EDGE and CB ×1.2). Then the Quantum
            Engine runs your squad through 10,000 Monte Carlo seasons before
            you play the real one — lose once and it's over. Every win pays
            Star Coins.
          </p>
          <button className="wr-btn ps-cta" onClick={startDraft}>
            Start the draft
          </button>
        </div>
      ) : null}

      {phase === "spin" || phase === "draft" ? (
        <div className="ps2-draft">
          <div className="ps2-head">
            <span className="ps2-round">
              Round <strong>{round}</strong>
              <em>/{ROUNDS}</em>
            </span>
            <span className={`ps2-side ps2-side--${roundSide(round).toLowerCase()}`}>
              {roundSide(round)}
            </span>
            <span className={`ps2-chip ps2-chip--team ${phase === "spin" ? "is-spinning" : ""}`}>
              <em>Team</em>
              {spinLabel.team}
            </span>
            <span className={`ps2-chip ps2-chip--era ${phase === "spin" ? "is-spinning" : ""}`}>
              <em>Era</em>
              {spinLabel.era}
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
                    <option value="rating">Rating</option>
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
            {mc ? "10,000 seasons, simulated." : "Simulating 10,000 seasons…"}
          </h3>
          {mc ? (
            <>
              <div className="ps2-engine__tiles">
                <div className="ps2-etile">
                  <span className="ps2-etile__label">Team score</span>
                  <span className="ps2-etile__value">{score.toFixed(1)}</span>
                </div>
                <div className="ps2-etile">
                  <span className="ps2-etile__label">Expected wins</span>
                  <span className="ps2-etile__value">{mc.meanWins.toFixed(1)}</span>
                </div>
                <div className="ps2-etile">
                  <span className="ps2-etile__label">Odds of 20-0</span>
                  <span className="ps2-etile__value">
                    {mc.pPerfect > 0
                      ? `1 in ${Math.max(1, Math.round(1 / mc.pPerfect)).toLocaleString("en-US")}`
                      : `< 1 in ${SIMS.toLocaleString("en-US")}`}
                  </span>
                </div>
              </div>
              <div className="ps2-hist" role="img" aria-label="Win distribution across 10,000 simulated seasons">
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
                Wins per simulated season · the red bar is immortality
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
                  mc && mc.pPerfect > 0
                    ? `1 in ${Math.max(1, Math.round(1 / mc.pPerfect)).toLocaleString("en-US")}`
                    : "longer than 1 in 10,000"
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
                +{reward.reward} Star Coins{perfect ? " · perfect-season bonus included" : ""}
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
