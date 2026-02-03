import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const STORAGE_DIR = path.join(__dirname, 'storage', 'events');

app.use(cors());
app.use(bodyParser.json());

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    console.log(`[Server] Created storage directory: ${STORAGE_DIR}`);
}

app.post('/api/events/sync', (req, res) => {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
        return res.status(400).json({ error: 'Invalid events payload' });
    }

    console.log(`[Server] Received ${events.length} events`);

    let savedCount = 0;

    events.forEach(event => {
        try {
            // content-type-id pattern
            const aggregateDirName = `${event.aggregateType}-${event.aggregateId}`;
            const aggregatePath = path.join(STORAGE_DIR, 'aggregates', aggregateDirName);

            // Ensure aggregate directory exists
            if (!fs.existsSync(aggregatePath)) {
                fs.mkdirSync(aggregatePath, { recursive: true });
            }

            // Write event file
            const fileName = `event-${event.eventId}.json`;
            const filePath = path.join(aggregatePath, fileName);

            fs.writeFileSync(filePath, JSON.stringify(event, null, 2));
            savedCount++;
            console.log(`[Server] Saved: ${fileName}`);
        } catch (err) {
            console.error(`[Server] Error saving event ${event.eventId}:`, err);
        }
    });

    res.json({ success: true, saved: savedCount });
});

// NEW: Endpoint to read all events from disk
app.get('/api/events/all', (req, res) => {
    console.log('[Server] Reading all events from disk...');
    const allEvents = [];
    const aggregatesDir = path.join(STORAGE_DIR, 'aggregates');

    if (fs.existsSync(aggregatesDir)) {
        const aggDirs = fs.readdirSync(aggregatesDir);

        aggDirs.forEach(aggDirName => {
            const aggPath = path.join(aggregatesDir, aggDirName);
            if (fs.statSync(aggPath).isDirectory()) {
                const eventFiles = fs.readdirSync(aggPath).filter(f => f.endsWith('.json'));

                eventFiles.forEach(file => {
                    try {
                        const content = fs.readFileSync(path.join(aggPath, file), 'utf-8');
                        allEvents.push(JSON.parse(content));
                    } catch (e) {
                        console.error('[Server] Failed to read event file:', file);
                    }
                });
            }
        });
    }

    // Sort by timestamp
    allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log(`[Server] Sending ${allEvents.length} events to client`);
    res.json({ events: allEvents });
});

app.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(`🚀  Sync Server running at http://localhost:${PORT}`);
    console.log(`📂  Writing files to: ${STORAGE_DIR}`);
    console.log(`---------------------------------------------------`);
});
