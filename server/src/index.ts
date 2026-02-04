import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './api/routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;
const HOST = process.env.SERVER_HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', routes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║          HouseForge Server Started                ║
╠═══════════════════════════════════════════════════╣
║  URL: http://${HOST}:${PORT}
║                                                   ║
║  Endpoints:                                       ║
║  - GET  /health          Health check             ║
║  - GET  /stats           Collection stats         ║
║  - GET  /metadata/:id    Token metadata           ║
║  - POST /vault/create    Create vault             ║
║  - GET  /vault/:id       Get vault                ║
║  - POST /fusion/prepare-commit  Prepare commit    ║
║  - POST /fusion/prepare-reveal  Prepare reveal    ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
