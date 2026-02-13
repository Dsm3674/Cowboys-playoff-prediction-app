const { computeClutchIndex } = require('./backend/clutch');
const players=[{id:'elitePlayer',name:'Elite QB',position:'QB',stats:{fourthQStats:{efficiency:0.98},regularStats:{efficiency:0.95},thirdDownStats:{success:50,attempts:50},fourthDownStats:{success:20,attempts:20},redZoneStats:{touchdowns:40,attempts:45},closeGameStats:{wins:80,closeGames:100},twoMinStats:{heroMoments:50},gameWinningStats:{gwSuccesses:20,gwAttempts:25},pressureStats:{successUnderPressure:40,pressurePlays:50}}}];
console.log(JSON.stringify(computeClutchIndex(players,{season:2025}),null,2));
