async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;
    const allGames = [];
    
    // NFL 2025 season: ~18 weeks (we'll fetch weeks 1-18)
    const maxWeeks = 18;
    
    console.log(`Fetching Cowboys games for ${year} season...`);
    
    for (let week = 1; week <= maxWeeks; week++) {
      try {
        // Fetch scoreboard for each week
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${week}`;
        
        const res = await fetch(url);
        if (!res.ok) continue;
        
        const data = await res.json();
        
        if (!data.events || data.events.length === 0) {
          console.log(`Week ${week}: No games`);
          break; // No more games this season
        }
        
        // Find Cowboys games in this week
        for (const event of data.events) {
          const competition = event.competitions?.[0];
          if (!competition) continue;
          
          const competitors = competition.competitors || [];
          const homeTeam = competitors.find(c => c.homeAway === "home");
          const awayTeam = competitors.find(c => c.homeAway === "away");
          
          if (!homeTeam || !awayTeam) continue;
          
          // Check if Dallas is playing
          const isDallasHome = homeTeam.team.abbreviation === "DAL";
          const isDallasAway = awayTeam.team.abbreviation === "DAL";
          
          if (!isDallasHome && !isDallasAway) continue;
          
          // Get scores
          const homeScore = parseInt(homeTeam.score) || 0;
          const awayScore = parseInt(awayTeam.score) || 0;
          
          // Check if completed
          const status = competition.status?.type;
          const isCompleted = status?.completed === true;
          
          const game = {
            week,
            homeTeam: {
              abbreviation: homeTeam.team.abbreviation,
              displayName: homeTeam.team.displayName,
              name: homeTeam.team.name,
              logo: homeTeam.team.logo
            },
            awayTeam: {
              abbreviation: awayTeam.team.abbreviation,
              displayName: awayTeam.team.displayName,
              name: awayTeam.team.name,
              logo: awayTeam.team.logo
            },
            homeScore,
            awayScore,
            completed: isCompleted,
            status: status?.name || "Scheduled",
            date: event.date
          };
          
          allGames.push(game);
          console.log(`Week ${week}: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} | ${game.awayScore}-${game.homeScore} | ${game.status}`);
        }
        
      } catch (weekError) {
        console.error(`Error fetching week ${week}:`, weekError.message);
      }
    }
    
    console.log(`Total Cowboys games found: ${allGames.length}`);
    return allGames;
    
  } catch (error) {
    console.error('Error fetching Cowboys games:', error);
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
    
    if (!isDalHome && !isDalAway) continue;
    
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
