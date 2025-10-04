# Dallas Cowboys Super Bowl Predictor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://opensource.org/)

A full-stack web application that uses advanced analytics to predict the Dallas Cowboys' chances of making the playoffs, winning their division, conference, and the Super Bowl. Built with React, Node.js/Express, and PostgreSQL.

**This is an open source project released under the MIT License. Contributions, forks, and stars are welcome! All you have to do is just be a Cowboys fan just kidding its fine**

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
```

**Important**: Never commit your `.env` file to version control!

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

The prediction engine calculates probabilities based on:

1. **Win Percentage** (30% weight) - Team's current season record
2. **Offensive Rating** (25% weight) - Based on points scored, total yards, and turnovers
3. **Defensive Rating** (25% weight) - Based on points allowed
4. **Injury Impact** (20% weight) - Penalties based on key player injuries

The algorithm outputs:
- Playoff probability
- Division win probability
- Conference championship probability
- Super Bowl win probability
- Overall confidence score

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

**Go Cowboys! 🏈**
