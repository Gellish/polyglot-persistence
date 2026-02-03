import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001; // New Port to avoid conflicts

// Extremely Permissive CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.get('/', (req, res) => {
    res.send('Debug Server is Running!');
});

// Mock Data Endpoint - Bypasses File System completely
app.get('/api/events/all', (req, res) => {
    console.log('[DebugServer] Client requested events...');
    const mockEvents = [
        {
            eventId: "debug-1",
            aggregateType: "debug",
            eventType: "DEBUG_TEST_CONNECTION",
            payload: { message: "If you see this, the SERVER CONNECTION is working!" },
            timestamp: new Date().toISOString()
        }
    ];
    res.json({ events: mockEvents });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`---------------------------------------------------`);
    console.log(`🛠️  DEBUG Server running at http://localhost:${PORT}`);
    console.log(`    (Also accessible via http://127.0.0.1:${PORT})`);
    console.log(`---------------------------------------------------`);
});
