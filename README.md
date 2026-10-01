# Dallas Cowboys Super Bowl Predictor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://opensource.org/)

A full-stack web application that uses advanced analytics to predict any NFL team's chances of making the playoffs, winning their division, conference, and the Super Bowl. Built with React, Node.js/Express, and PostgreSQL.

**This is an open source project released under the MIT License. Contributions, forks, and stars are welcome!**

## Features

- **Real-time Predictions**: AI-powered prediction engine analyzing team performance
- **Interactive Dashboard**: Beautiful UI showing playoff probabilities with visual progress indicators
- **Player Analytics**: Track key players, injury status, and performance ratings
- **Game Statistics**: Detailed game-by-game breakdown with offensive/defensive metrics
- **Prediction History**: Track how predictions change over time
- **Responsive Design**: Modern, gradient-based UI that works on all devices

## Tech Stack

### Frontend
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Lucide React (icons)

### Backend
- Node.js
- Express.js
- PostgreSQL (via Neon)
- CORS enabled for cross-origin requests

### Authentication
- Stack Auth integration

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database (or Neon account)
- npm or yarn package manager

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cowboys-superbowl-predictor.git
cd cowboys-superbowl-predictor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Server Configuration
PORT=3001

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Vite Environment Variables (for React frontend)
VITE_API_URL=http://localhost:3001

# Stack Auth (get keys from your Stack dashboard at https://app.stack-auth.com)
VITE_STACK_PROJECT_ID=your_project_id_here
VITE_STACK_PUBLISHABLE_CLIENT_KEY=your_publishable_key_here
STACK_SECRET_SERVER_KEY=your_secret_key_here

# Auth
# Use independent, randomly generated secrets in production.
SESSION_SECRET=replace_with_a_long_random_value
EMAIL_OTP_SECRET=replace_with_a_different_long_random_value
ANON_AUTH_SECRET=replace_with_another_long_random_value

# Required for production Gmail signup and password reset codes.
RESEND_API_KEY=re_your_resend_api_key
NOTIFICATION_EMAIL_FROM=LoneStar AI <login@your-verified-domain.example>
```

**Important**: Never commit your `.env` file to version control!

Production authentication fails closed when these secrets or email delivery
are unavailable. Development and test environments may return a `devCode` for
local testing, but production never exposes verification codes in API responses.

### 4. Database Setup

Initialize the database with tables and seed data:

```bash
npm run init-db
```

This will:
- Create all necessary tables (teams, seasons, game_stats, players, predictions)
- Seed initial data for the Dallas Cowboys 2024 season
- Set up database indexes and views

## Running the Application

### Development Mode

Start the backend server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

### Frontend Setup

If your frontend is in a separate directory, navigate to it and:
```bash
npm install
npm run dev
```

The frontend will typically run on `http://localhost:5173`

## API Endpoints

### Predictions
- `GET /api/predictions/current` - Get current season data and latest prediction
- `POST /api/predictions/generate` - Generate a new prediction
- `GET /api/predictions/history?limit=20` - Get prediction history

### Teams
- `GET /api/teams/:teamId/seasons?limit=10` - Get team's season history
- `GET /api/teams/:teamId/current` - Get team's current season with stats

### Health Check
- `GET /health` - API health status

## Project Structure

```
├── server.js              # Main Express server
├── databases.js           # PostgreSQL connection pool
├── initDatabase.js        # Database initialization script
├── schema.sql             # Database schema
├── seed.sql               # Initial seed data
├── prediction.js          # Saved-prediction builder (odds from the league sim)
├── seasons.js             # Season model
├── teams.js               # Team model
├── superbowlPath.js       # Prediction routes
├── package.json           # Node dependencies
└── .gitignore             # Git ignore rules
```

## Prediction Algorithm

The model has four parts.

1. **Power ratings** (`backend/services/ratingsEngine.js`). FiveThirtyEight-style Elo: K = 20, +30 home field (none at neutral sites), margin-of-victory multiplier, replayed from every completed game. The preseason prior is last season's final Elo regressed one-third toward 1500, blended 60/40 with a rating implied by de-vigged Super Bowl futures. QB, injury and trade news are applied as Elo deltas. TSI (a season-stats summary) is reported but not added to the rating.
2. **Game probabilities.** Elo, except where a game has a sportsbook line (this week's games, from ESPN): then the de-vigged line is used, because it scored better than Elo on 2012-25 games and blending Elo back in made it worse.
3. **League season simulation** (`backend/services/seasonSimulator.js`). Every remaining regular-season game for all 32 teams. Ratings run "hot": each simulated result updates both teams' Elo, so uncertainty grows the further out the forecast is. Standings are settled with the NFL tiebreakers (head-to-head, division record, common games, conference record, strength of victory, strength of schedule, net points, coin flip), and seeds 1-7 go into a bracket that reseeds after the wild-card round. 10,000 seasons by default, up to 100,000.
4. **Path analysis** (`backend/services/playoffPathEngine.js`). Every simulated postseason is logged jointly, which answers conditional questions such as a team's title odds when the other conference's #1 seed is upset.
5. **Game leverage** (`gameLeverage` in the simulator, used by `seasonPath.js` and `rivalAnalysis.js`). For every remaining game the simulation records each team's playoff rate when the home side wins and when the away side wins. That drives must-win swings (a team's own games), the rooting guide (`GET /api/model/rooting-guide?team=DAL`, everyone else's games) and the rival page's measured impact, with division races and tiebreakers included.

The matchup simulator uses the same Elo game forecast; the season-path page lists the most likely win/loss sequences from the model's per-game odds.

**Injury impact.** Automatic Elo deltas from ESPN's injury report and depth charts: `(1 - P(plays)) × positional spread value × 25 Elo/pt`, starters only, faded for long absences, capped at -250 Elo per team. The upcoming game takes the full cost; season projections spread it over the games each player is expected to miss (ESPN return date, else 4 for IR, 1 for game designations). A manual QB/INJURY adjustment replaces the automatic delta for that team. See `backend/services/injuries.js`.

Outputs per team: projected wins, playoff, division, #1-seed, conference and Super Bowl probabilities, seed distribution, and playoff odds by final win total.

### How it was validated

All on nflverse data (every game since 1999 with closing lines):

| Check | Result |
|---|---|
| Tiebreakers: replay each finished season 2002-25 | Seeds 1-6 match the NFL's every season; all 7 seeds match every season since the 2020 format |
| Game forecasts 2021-25 (1,355 games), Brier, lower is better | Model 0.2245 (63.5% picked right) · Vegas closing 0.2117 (66.5%) · home field only 0.2485 · coin flip 0.25 |
| Playoff odds 2021-25, all 32 teams | Brier 0.174 after week 4, 0.152 after week 8, 0.124 after week 12, vs 0.246 for a naive 14/32 |
| Hot vs fixed ratings in the season sim, 2012-25 | Hot scored better at weeks 4, 8 and 12 |

What the evidence changed:

- **Home field 48 → 30 Elo.** The best fit fell from ~60 (2012-16) to ~40 (2017-20) to ~30 (2021-25), in line with research on shrinking home advantage (Lopez, Matthews & Baumer 2018).
- **Removed the point-differential and TSI overlays.** Elo's margin-of-victory multiplier already uses scoring margin; adding point differential made forecasts worse at every weight tried, and TSI (built from the same points and records) did too at the weight used (Brier 0.2210 vs 0.2207 without it, 2012-25).
- **Sportsbook lines for games that have one** (Baker & McHale 2013: models trail the market on game outcomes).
- **QB injuries.** A backup QB start cost about 90 Elo in the backtest; the injury model prices a full QB absence at about 112, close enough to keep.

**Run it yourself.** `npm run backtest` (in `backend/`) scores the last five seasons; `npm run backtest -- 2018 2025 --tune` scores a range and grid-searches K and home field. It downloads nflverse's games file (set `NFLVERSE_GAMES_FILE` to a local copy to run offline) and falls back to ESPN. The same report is at `GET /api/model/backtest?from=2021&to=2025` and in the Ratings Lab.

## Database Schema

### Main Tables
- `teams` - NFL team information
- `seasons` - Season records by team and year
- `game_stats` - Individual game statistics
- `players` - Player roster with injury status
- `predictions` - Historical predictions with factors
- `opponents` - Opponent information per game

## Stack Auth Setup

1. Create an account at [Stack Auth](https://app.stack-auth.com)
2. Create a new project
3. Copy your Project ID, Publishable Client Key, and Secret Server Key
4. Add them to your `.env` file

## Deployment

### War Room AI chatbot

Set this on the **backend/server** service:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
```

Do not use a `VITE_` prefix and do not put the key in the frontend. The optional
`OPENROUTER_MODEL` variable selects a specific model; when omitted, the app uses
OpenRouter's maintained `openrouter/free` router. You can also set
`OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME` for OpenRouter app attribution.
Restart or redeploy the backend after changing these variables.

### Backend (Node.js)
Deploy to platforms like:
- Heroku
- Railway
- Render
- AWS EC2/ECS

### Frontend (React)
Deploy to platforms like:
- Vercel
- Netlify
- AWS S3 + CloudFront

### Database
- Use Neon (managed PostgreSQL)
- Or any PostgreSQL-compatible service

Remember to set environment variables in your deployment platform!

## Security Notes

- Never commit `.env` files
- Rotate all credentials before making repository public
- Use environment variables for all sensitive data
- Enable SSL for database connections in production
- Set `NODE_ENV=production` in production environments

## Contributing

We welcome contributions from the community! This is an open source project and we'd love your help making it better.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Contribution Ideas

- 🎨 Improve the UI/UX design
- 📊 Enhance the prediction algorithm
- 🏈 Add more teams (not just Cowboys)
- 📱 Make it more mobile-responsive
- 🧪 Add unit tests
- 📖 Improve documentation
- 🐛 Fix bugs or issues
- ✨ Suggest new features

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

All contributions, no matter how small, are valued and appreciated!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

You are free to:
- ✅ Use this project commercially
- ✅ Modify the code
- ✅ Distribute copies
- ✅ Use it privately
- ✅ Sublicense it

The only requirement is that you include the original copyright and license notice in any copy of the software.

## Acknowledgments

- Dallas Cowboys for being America's Team
- NFL for the game statistics structure
- Neon for PostgreSQL hosting
- Stack Auth for authentication

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Honestly things have not been going well this season so just wait till next season to fully use this app**
