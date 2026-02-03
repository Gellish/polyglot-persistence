import { defineConfig } from 'vite';
import { syncStorePlugin } from './vite-plugin-sync-store';

export default defineConfig({
    root: 'dashboard', // Serve from dashboard/ directory
    base: './',
    server: {
        port: 5175
    },
    plugins: [
        syncStorePlugin() // Add our middleware
    ]
});
