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
├── chance.js              # Prediction algorithm engine
├── prediction.js          # Prediction model
├── seasons.js             # Season model
├── teams.js               # Team model
├── superbowlPath.js       # Prediction routes
├── team2.js               # Team routes
├── package.json           # Node dependencies
└── .gitignore             # Git ignore rules
```

## Prediction Algorithm

The model has three layers.

1. **Power ratings** (`backend/services/ratingsEngine.js`). FiveThirtyEight-style Elo: K = 20, +48 home field, margin-of-victory multiplier, replayed from every completed game. The preseason prior is last season's final Elo regressed one-third toward 1500, blended 60/40 with a rating implied by de-vigged Super Bowl futures. QB, injury and trade news are applied as Elo deltas, and a small overlay from point differential and TSI is added.
2. **League season simulation** (`backend/services/seasonSimulator.js`). Every remaining regular-season game, for all 32 teams, is played from those ratings. Ratings run "hot": each simulated result updates both teams' Elo, so uncertainty grows the further out the forecast is. Standings are settled with the NFL tiebreakers (head-to-head, division record, common games, conference record, strength of victory, strength of schedule, net points, coin flip), and seeds 1-7 go into a bracket that reseeds after the wild-card round. 10,000 seasons by default, up to 100,000.
3. **Path analysis** (`backend/services/playoffPathEngine.js`). Every simulated postseason is logged jointly, which answers conditional questions such as a team's title odds when the other conference's #1 seed is upset.

**Injury impact.** - Automatic Elo deltas from ESPN's injury report and depth charts: `(1 - P(plays)) × positional spread value × 25 Elo/pt`, starters only, faded for long absences, capped at -250 Elo per team. The upcoming game takes the full cost; season projections spread it over the games each player is expected to miss (ESPN return date, else 4 for IR, 1 for game designations). A manual QB/INJURY adjustment replaces the automatic delta for that team. See `backend/services/injuries.js`.

Outputs per team: projected wins, playoff, division, #1-seed, conference and Super Bowl probabilities, seed distribution, and playoff odds by final win total.

**Backtest.** `npm run backtest -- 2025` (in `backend/`) replays a finished season using only what the model knew each week. It reports game-level Brier score, log loss, accuracy and calibration against coin-flip and home-field baselines, and playoff-odds Brier at weeks 4, 8, 12 and 16. Add `--tune` to grid-search K and home field. The same report is served at `GET /api/model/backtest?year=2025` and shown in the Ratings Lab.

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
