// Main entry point for the Chat API - developed by Viswas
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';

// Load environment variables
dotenv.config();

// Global Error Handlers to prevent server crashes from unhandled promise rejections (like broken AI streams)
process.on('uncaughtException', (err) => {
    console.error('[Global Error] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Global Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to the database
connectDB();

// Apply Global Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Setup API Routes
app.use('/api/chats', chatRoutes);

// Health check route
app.get('/', (req, res) => {
    res.send('Chat API service is active and running...');
});

app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});
