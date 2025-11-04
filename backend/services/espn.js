async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`;
    
    console.log('Fetching from:', url);
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.events || !Array.isArray(data.events)) {
      console.warn('No events array in ESPN response');
      return [];
    }
    
    console.log(`Total events: ${data.events.length}`);
    
    const games = data.events.map((e, idx) => {
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
        
        // Check if game is completed - try multiple ways
        const status = competition.status?.type;
        const completed = status?.completed === true || 
                         status?.state === "post" ||
                         competition.status?.type?.description === "Final";
        
        const game = {
          homeTeam: homeComp.team || { abbreviation: "UNK", displayName: "Unknown" },
          awayTeam: awayComp.team || { abbreviation: "UNK", displayName: "Unknown" },
          homeScore,
          awayScore,
          completed,
          status: status?.name || "Unknown"
        };
        
        console.log(`Game ${idx + 1}: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} | ${game.awayScore}-${game.homeScore} | Completed: ${game.completed} | Status: ${game.status}`);
        
        return game;
      } catch (err) {
        console.error('Error parsing game:', err);
        return null;
      }
    }).filter(game => game !== null);
    
    console.log(`Total games parsed: ${games.length}`);
    return games;
  } catch (error) {
    console.error('Error fetching Cowboys games:', error);
    return [];
  }
}

function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;
  
  if (!games || !Array.isArray(games)) {
    console.log('No games array provided');
    return { wins: 0, losses: 0, ties: 0, winPct: 0, text: "0-0-0" };
  }
  
  console.log(`Computing record from ${games.length} games`);
  
  for (const game of games) {
    // Only count completed games
    if (!game.completed) {
      console.log(`Skipping incomplete game: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
      continue;
    }
    
    // Skip games with missing data
    if (!game.homeTeam?.abbreviation || !game.awayTeam?.abbreviation) {
      console.log('Skipping game with missing team data');
      continue;
    }
    
    const isDalHome = game.homeTeam.abbreviation === "DAL";
    const isDalAway = game.awayTeam.abbreviation === "DAL";
    
    // Skip if Dallas isn't playing
    if (!isDalHome && !isDalAway) {
      console.log(`Skipping non-Dallas game: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
      continue;
    }
    
    if (isDalHome) {
      if (game.homeScore > game.awayScore) {
        wins++;
        console.log(`✅ WIN (Home): DAL ${game.homeScore} - ${game.awayScore} ${game.awayTeam.abbreviation}`);
      } else if (game.homeScore < game.awayScore) {
        losses++;
        console.log(`❌ LOSS (Home): DAL ${game.homeScore} - ${game.awayScore} ${game.awayTeam.abbreviation}`);
      } else {
        ties++;
        console.log(`🟰 TIE (Home): DAL ${game.homeScore} - ${game.awayScore} ${game.awayTeam.abbreviation}`);
      }
    } else if (isDalAway) {
      if (game.awayScore > game.homeScore) {
        wins++;
        console.log(`✅ WIN (Away): ${game.homeTeam.abbreviation} ${game.homeScore} - ${game.awayScore} DAL`);
      } else if (game.awayScore < game.homeScore) {
        losses++;
        console.log(`❌ LOSS (Away): ${game.homeTeam.abbreviation} ${game.homeScore} - ${game.awayScore} DAL`);
      } else {
        ties++;
        console.log(`🟰 TIE (Away): ${game.homeTeam.abbreviation} ${game.homeScore} - ${game.awayScore} DAL`);
      }
    }
  }
  
  const total = wins + losses + ties;
  const winPct = total > 0 ? Number((wins / total).toFixed(3)) : 0;
  
  console.log(`📊 Final Record: ${wins}-${losses}-${ties} (${winPct})`);
  
  return { 
    wins, 
    losses, 
    ties, 
    winPct, 
    text: `${wins}-${losses}-${ties}` 
  };
}

module.exports = { fetchCowboysGamesSeasonToDate, computeRecordFromGames };

