async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;
    
    // Use the scoreboard API which has complete score data
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/schedule?season=${year}`;
    
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
    
    const games = [];
    
    for (let i = 0; i < data.events.length; i++) {
      const event = data.events[i];
      
      try {
        const competition = event.competitions[0];
        const competitors = competition.competitors;
        
        // Find home and away teams
        const homeTeam = competitors.find(c => c.homeAway === "home");
        const awayTeam = competitors.find(c => c.homeAway === "away");
        
        if (!homeTeam || !awayTeam) continue;
        
        // Get scores - try multiple possible locations
        let homeScore = 0;
        let awayScore = 0;
        
        // Method 1: Direct score field (string)
        if (homeTeam.score) {
          homeScore = parseInt(homeTeam.score) || 0;
        }
        if (awayTeam.score) {
          awayScore = parseInt(awayTeam.score) || 0;
        }
        
        // Check completion status
        const status = competition.status.type;
        const isCompleted = status.completed === true || status.state === "post";
        
        const game = {
          homeTeam: {
            abbreviation: homeTeam.team.abbreviation,
            displayName: homeTeam.team.displayName,
            name: homeTeam.team.name
          },
          awayTeam: {
            abbreviation: awayTeam.team.abbreviation,
            displayName: awayTeam.team.displayName,
            name: awayTeam.team.name
          },
          homeScore,
          awayScore,
          completed: isCompleted,
          status: status.name
        };
        
        console.log(`Game ${i + 1}: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} | ${game.awayScore}-${game.homeScore} | Completed: ${game.completed}`);
        
        games.push(game);
        
      } catch (err) {
        console.error(`Error parsing game ${i + 1}:`, err);
      }
    }
    
    console.log(`Successfully parsed ${games.length} games`);
    return games;
    
  } catch (error) {
    console.error('Error fetching Cowboys schedule:', error);
    return [];
  }
}

function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;
  
  if (!games || !Array.isArray(games) || games.length === 0) {
    console.log('No games to compute');
    return { wins: 0, losses: 0, ties: 0, winPct: 0, text: "0-0-0" };
  }
  
  console.log(`\n=== Computing Cowboys Record ===`);
  
  for (const game of games) {
    // Only count completed games
    if (!game.completed) {
      continue;
    }
    
    const isDalHome = game.homeTeam.abbreviation === "DAL";
    const isDalAway = game.awayTeam.abbreviation === "DAL";
    
    if (!isDalHome && !isDalAway) {
      continue; // Not a Cowboys game
    }
    
    // Determine win/loss/tie
    if (isDalHome) {
      if (game.homeScore > game.awayScore) {
        wins++;
        console.log(`✅ WIN: DAL ${game.homeScore} vs ${game.awayTeam.abbreviation} ${game.awayScore}`);
      } else if (game.homeScore < game.awayScore) {
        losses++;
        console.log(`❌ LOSS: DAL ${game.homeScore} vs ${game.awayTeam.abbreviation} ${game.awayScore}`);
      } else {
        ties++;
        console.log(`🟰 TIE: DAL ${game.homeScore} vs ${game.awayTeam.abbreviation} ${game.awayScore}`);
      }
    } else if (isDalAway) {
      if (game.awayScore > game.homeScore) {
        wins++;
        console.log(`✅ WIN: DAL ${game.awayScore} @ ${game.homeTeam.abbreviation} ${game.homeScore}`);
      } else if (game.awayScore < game.homeScore) {
        losses++;
        console.log(`❌ LOSS: DAL ${game.awayScore} @ ${game.homeTeam.abbreviation} ${game.homeScore}`);
      } else {
        ties++;
        console.log(`🟰 TIE: DAL ${game.awayScore} @ ${game.homeTeam.abbreviation} ${game.homeScore}`);
      }
    }
  }
  
  const total = wins + losses + ties;
  const winPct = total > 0 ? Number((wins / total).toFixed(3)) : 0;
  
  console.log(`\n📊 FINAL RECORD: ${wins}-${losses}-${ties} (Win %: ${(winPct * 100).toFixed(1)}%)`);
  console.log(`===========================\n`);
  
  return { 
    wins, 
    losses, 
    ties, 
    winPct, 
    text: `${wins}-${losses}-${ties}` 
  };
}

module.exports = { fetchCowboysGamesSeasonToDate, computeRecordFromGames };
