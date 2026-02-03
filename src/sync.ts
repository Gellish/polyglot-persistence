import { EventStore } from './eventStore';
import { Event } from './types';

const SYNC_INTERVAL = 5000; // 5 seconds
let BACKEND_URL = '/api/events/sync';

export class SyncEngine {
    static intervalId: any = null;
    static isSyncing = false;

    /**
     * Configure the backend URL
     * @param {string} url 
     */
    static setBackendUrl(url: string) {
        BACKEND_URL = url;
    }

    static start() {
        if (this.intervalId) return;

        console.log('[SyncEngine] Started');
        this.intervalId = setInterval(() => this.sync(), SYNC_INTERVAL);

        // Also sync immediately on online event
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.sync());
        }
    }

    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Fetch all events from the backend and populate local store
     * @returns {Promise<Event[] | false>} success
     */
    static async fetchRemoteEvents(): Promise<Event[] | false> {
        if (!BACKEND_URL.includes('sync')) {
            console.warn('[SyncEngine] Backend URL not configured correctly');
            return false;
        }

        const fetchUrl = BACKEND_URL.replace('/sync', '/all');
        console.log(`[SyncEngine] Fetching remote events from ${fetchUrl}...`);

        try {
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                console.warn('[SyncEngine] Failed to fetch remote events', response.status);
                return false;
            }

            const data = await response.json();
            if (data.events && Array.isArray(data.events)) {
                console.log(`[SyncEngine] Received ${data.events.length} remote events.`);
                return data.events as Event[];
            }
        } catch (e) {
            console.error('[SyncEngine] Network error fetching remote events', e);
        }
        return false;
    }

    static async sync() {
        // Guard: Offline or already syncing
        if (this.isSyncing) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        const outbox = EventStore.getOutbox();
        if (outbox.length === 0) return;

        this.isSyncing = true;
        console.log(`[SyncEngine] Syncing ${outbox.length} events...`);

        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: outbox })
            });

            if (response.ok) {
                // Remove synced events from outbox
                const syncedIds = outbox.map(e => e.eventId);
                EventStore.removeFromOutbox(syncedIds);
                console.log('[SyncEngine] Sync successful');
            } else {
                if (response.status === 404) {
                    console.warn('[SyncEngine] Sync endpoint not found (404).', BACKEND_URL);
                } else {
                    console.error('[SyncEngine] Sync failed', response.statusText);
                }
            }
        } catch (e) {
            console.error('[SyncEngine] Network error during sync', e);
        } finally {
            this.isSyncing = false;
        }
    }
}
