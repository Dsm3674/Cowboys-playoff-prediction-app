const rateLimit = require('express-rate-limit');

// Specialized limiter for heavy "Quantum" calculations
export const simulationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 heavy sims per window
  message: {
    error: "Quantum Engine Overheating",
    message: "High-fidelity simulations are resource intensive. Please wait 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});
