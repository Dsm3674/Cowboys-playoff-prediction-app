async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.events || !Array.isArray(data.events)) {
      console.warn('No events array in ESPN response');
      return [];
    }
    
    const games = data.events.map(e => {
      try {
        const competition = e.competitions?.[0];
        if (!competition) return null;
        
        const competitors = competition.competitors || [];
        const homeComp = competitors.find(c => c.homeAway === "home");
        const awayComp = competitors.find(c => c.homeAway === "away");
        
        if (!homeComp || !awayComp) return null;
        
        // Parse scores - handle string and number formats
        const homeScore = Number(homeComp.score) || 0;
        const awayScore = Number(awayComp.score) || 0;
        
        // Check if game is completed
        const status = competition.status?.type;
        const completed = status?.completed === true || status?.state === "post";
        
        return {
          homeTeam: homeComp.team || { abbreviation: "UNK", displayName: "Unknown" },
          awayTeam: awayComp.team || { abbreviation: "UNK", displayName: "Unknown" },
          homeScore,
          awayScore,
          completed,
          status: status?.name || "Unknown"
        };
      } catch (err) {
        console.error('Error parsing game:', err);
        return null;
      }
    }).filter(game => game !== null);
    
    return games;
  } catch (error) {
    console.error('Error fetching Cowboys games:', error);
    return [];
  }
}

function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;
  
  if (!games || !Array.isArray(games)) {
    return { wins: 0, losses: 0, ties: 0, winPct: 0, text: "0-0-0" };
  }
  
  for (const game of games) {
    // Only count completed games
    if (!game.completed) continue;
    
    // Skip games with missing data
    if (!game.homeTeam?.abbreviation || !game.awayTeam?.abbreviation) continue;
    
    const isDalHome = game.homeTeam.abbreviation === "DAL";
    const isDalAway = game.awayTeam.abbreviation === "DAL";
    
    // Skip if Dallas isn't playing
    if (!isDalHome && !isDalAway) continue;
    
    if (isDalHome) {
      if (game.homeScore > game.awayScore) {
        wins++;
      } else if (game.homeScore < game.awayScore) {
        losses++;
      } else {
        ties++;
      }
    } else if (isDalAway) {
      if (game.awayScore > game.homeScore) {
        wins++;
      } else if (game.awayScore < game.homeScore) {
        losses++;
      } else {
        ties++;
      }
    }
  }
  
  const total = wins + losses + ties;
  const winPct = total > 0 ? Number((wins / total).toFixed(3)) : 0;
  
  return { 
    wins, 
    losses, 
    ties, 
    winPct, 
    text: `${wins}-${losses}-${ties}` 
  };
}

module.exports = { fetchCowboysGamesSeasonToDate, computeRecordFromGames };

