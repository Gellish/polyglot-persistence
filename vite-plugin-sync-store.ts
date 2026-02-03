import fs from 'fs';
import path from 'path';
import { Connect } from 'vite';
import { IncomingMessage, ServerResponse } from 'http';
import { Event } from './src/types';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage/events');
const MAX_SEGMENT_SIZE = 100;

// USER SETTING: Set to true to enable debug logging to 'server-debug.log'
const ENABLE_DEBUG_LOG = true;

function logDebug(message: string) {
    if (ENABLE_DEBUG_LOG) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        // Write to absolute path to avoid CWD confusion
        const logPath = path.resolve(process.cwd(), 'server-debug.log');
        fs.appendFileSync(logPath, logLine);
    }
}

if (ENABLE_DEBUG_LOG) {
    console.log('[ViteSync] 🔍 Debug Logging Enabled -> server-debug.log');
}

type ViteReq = Connect.IncomingMessage;
type ViteRes = ServerResponse;
type Next = Connect.NextFunction;

// --- Security Helpers ---

function sanitize(str: string): string {
    if (!str) return 'unknown';
    return str.replace(/[^a-zA-Z0-9\-\_]/g, '').substring(0, 50);
}

function getSlugFromEvent(event: any): string {
    const p = event.payload || {};
    const candidate = p.slug || p.title || p.name || p.email || p.username;
    return sanitize(candidate || 'data');
}

// --- Logic ---

function saveEventsToDisk(events: Event[]): number {
    if (!events || !Array.isArray(events)) return 0;

    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

    let count = 0;
    events.forEach(event => {
        try {
            if (!event.aggregateId || !event.aggregateType) {
                console.warn('[ViteSync] 🛡️ Security: Rejected event missing ID or Type');
                return;
            }

            const typeSafe = sanitize(event.aggregateType);
            const idSafe = sanitize(event.aggregateId);
            const slugSafe = getSlugFromEvent(event);

            const typeDir = path.join(STORAGE_DIR, 'aggregates', typeSafe);
            if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });

            let aggregateDirName = `${slugSafe}--${idSafe}`;

            // Try to preserve existing slug/folder if ID matches
            const existingDirs = fs.readdirSync(typeDir);
            const existingDir = existingDirs.find(d => d.endsWith(`--${idSafe}`));
            if (existingDir) {
                aggregateDirName = existingDir;
            }

            const aggregatePath = path.join(typeDir, aggregateDirName);
            if (!fs.existsSync(aggregatePath)) fs.mkdirSync(aggregatePath, { recursive: true });

            // Trash Logic
            if (event.eventType.endsWith('_DELETED')) {
                const trashRoot = path.resolve(process.cwd(), 'storage/.event-trash');
                const trashPath = path.join(trashRoot, typeSafe, aggregateDirName);
                if (!fs.existsSync(path.dirname(trashPath))) fs.mkdirSync(path.dirname(trashPath), { recursive: true });

                try {
                    if (fs.existsSync(trashPath)) fs.rmSync(trashPath, { recursive: true, force: true });
                    fs.renameSync(aggregatePath, trashPath);
                    console.log(`[ViteSync] 🗑️ Moved to Trash: ${typeSafe}/${aggregateDirName}`);
                } catch (err) { console.error('[ViteSync] Recycle Bin Error:', err); }
                return;
            }

            // Segmented Write
            const segments = fs.readdirSync(aggregatePath).filter(f => f.startsWith('segment-') && f.endsWith('.json'));
            segments.sort();

            let currentSegmentFile = segments.length > 0 ? segments[segments.length - 1] : 'segment-001.json';
            let currentSegmentPath = path.join(aggregatePath, currentSegmentFile);
            let segmentData: Event[] = [];

            if (fs.existsSync(currentSegmentPath)) {
                try {
                    segmentData = JSON.parse(fs.readFileSync(currentSegmentPath, 'utf-8'));
                } catch (e) {
                    segmentData = [];
                }
            }

            if (segmentData.length >= MAX_SEGMENT_SIZE) {
                const nextNum = parseInt(currentSegmentFile.replace('segment-', '').replace('.json', '')) + 1;
                currentSegmentFile = `segment-${String(nextNum).padStart(3, '0')}.json`;
                currentSegmentPath = path.join(aggregatePath, currentSegmentFile);
                segmentData = [];
            }

            if (!segmentData.find(e => e.eventId === event.eventId)) {
                segmentData.push(event);
                segmentData.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
                fs.writeFileSync(currentSegmentPath, JSON.stringify(segmentData, null, 2));
                count++;
                console.log(`[ViteSync] Saved to ${aggregateDirName}/${currentSegmentFile}`);
            }

        } catch (e) { console.error(e); }
    });
    return count;
}

function readAllEventsFromDisk(): Event[] {
    const allEvents: Event[] = [];
    const aggregatesRoot = path.join(STORAGE_DIR, 'aggregates');

    if (!fs.existsSync(aggregatesRoot)) return [];

    const typeDirs = fs.readdirSync(aggregatesRoot);

    typeDirs.forEach(type => {
        const typePath = path.join(aggregatesRoot, type);
        if (!fs.statSync(typePath).isDirectory()) return;

        const aggDirs = fs.readdirSync(typePath);

        aggDirs.forEach(aggDir => {
            const aggPath = path.join(typePath, aggDir);
            if (!fs.statSync(aggPath).isDirectory()) return;

            const files = fs.readdirSync(aggPath).filter(f => f.endsWith('.json'));

            files.forEach(f => {
                try {
                    const content = fs.readFileSync(path.join(aggPath, f), 'utf-8');
                    const data = JSON.parse(content);

                    if (f.startsWith('segment-') && Array.isArray(data)) {
                        // New Format: Array of Events
                        allEvents.push(...data);
                    } else if (f.startsWith('event-') && !Array.isArray(data)) {
                        // Legacy Format: Single Event Object
                        allEvents.push(data);
                    }
                } catch (e) {
                    console.error(`[ViteSync] ⚠️ Skipping Corrupt File: ${aggDir}/${f}`);
                }
            });
        });
    });

    allEvents.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    console.log(`[ViteSync] Served ${allEvents.length} events from ${aggregatesRoot}.`);
    return allEvents;
}

export function syncStorePlugin() {
    return {
        name: 'vite-plugin-sync-store',
        configureServer(server: any) {
            server.middlewares.use('/api/events/sync', async (req: ViteReq, res: ViteRes, next: Next) => {
                if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const { events } = JSON.parse(body);
                            const savedCount = saveEventsToDisk(events);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, saved: savedCount }));
                        } catch (e: any) {
                            console.error('Middleware Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                } else {
                    next();
                }
            });

            server.middlewares.use('/api/events/all', (req: ViteReq, res: ViteRes, next: Next) => {
                if (req.method === 'GET' || req.method === 'get') {
                    logDebug(`[API] Fetch All Events Request: ${req.url}`);
                    try {
                        const allEvents = readAllEventsFromDisk();
                        logDebug(`[API] Serving ${allEvents.length} events to client.`);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ events: allEvents }));
                    } catch (e: any) {
                        console.error('Middleware Error:', e);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: e.message }));
                    }
                } else {
                    next();
                }
            });
        }
    }
}
