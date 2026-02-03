import { EventStore } from '../src/eventStore';
import { seedDatabase } from '../src/seed';
import { SyncEngine } from '../src/sync';
import { Event, Aggregate } from '../src/types';

// --- Data Grid State ---
console.log('[App] Initializing visibleColumns...');
var visibleColumns: string[] = JSON.parse(localStorage.getItem('visibleColumns') || '["id", "type", "version"]');
var textFilters: Record<string, string> = {};
console.log('[App] visibleColumns initialized:', visibleColumns);

// Set to local server (Vite Middleware)
SyncEngine.setBackendUrl('/api/events/sync');
SyncEngine.start();

// --- UI Logic ---

interface Elements {
    content: HTMLElement;
    statAggregates: HTMLElement;
    statEvents: HTMLElement;
    statOutbox: HTMLElement;
    btnSeed: HTMLButtonElement;
    btnLoad: HTMLButtonElement | null;
    btnRefresh: HTMLButtonElement;
    btnClear: HTMLButtonElement;
    tabs: NodeListOf<HTMLElement>;
}

const els: Elements = {
    content: document.getElementById('content') as HTMLElement,
    statAggregates: document.getElementById('statAggregates') as HTMLElement,
    statEvents: document.getElementById('statEvents') as HTMLElement,
    statOutbox: document.getElementById('statOutbox') as HTMLElement,
    btnSeed: document.getElementById('btnSeed') as HTMLButtonElement,
    btnLoad: document.getElementById('btnLoad') as HTMLButtonElement,
    btnRefresh: document.getElementById('btnRefresh') as HTMLButtonElement,
    btnClear: document.getElementById('btnClear') as HTMLButtonElement,
    tabs: document.querySelectorAll('.tab')
};

let currentView = 'aggregates';

// --- Data Grid State (Moved to top) ---

// --- Event Listeners (Attached immediately) ---

els.btnSeed.onclick = async () => {
    if (confirm('Add example data (User + Page)?')) {
        try {
            await seedDatabase();
            render();
        } catch (e: any) {
            alert('Seeding failed: ' + e.message);
            console.error(e);
        }
    }
};

if (els.btnLoad) {
    els.btnLoad.onclick = async () => {
        if (confirm('Import all events from Server Disk (storage/events)? This will merge with local data.')) {
            try {
                // Show loading state
                const originalText = els.btnLoad!.innerText;
                els.btnLoad!.innerText = '⏳ Loading...';

                const events = await SyncEngine.fetchRemoteEvents();
                if (events) {
                    let count = 0;
                    events.forEach(e => {
                        EventStore.saveToStream(e);
                        count++;
                    });
                    alert(`Imported ${count} events from disk!`);
                    render();
                } else {
                    alert('Failed to import. Is the server running? Check console for details.');
                }
                els.btnLoad!.innerText = originalText;
            } catch (e: any) {
                alert('Import error: ' + e.message);
                els.btnLoad!.innerText = '📥 Import from Disk';
            }
        }
    };
}

els.btnClear.onclick = () => {
    if (confirm('ARE YOU SURE? This will wipe all local data from your browser.\n\n(Server data remains intact)')) {
        localStorage.clear();
        render();
        alert('Local database wiped.');
    }
};

els.btnRefresh.onclick = () => {
    render();
    // Also trigger a background sync check
    SyncEngine.fetchRemoteEvents().then(events => {
        if (events) {
            console.log('Background refresh: loaded ', events.length, ' events');
            render();
        }
    });
};

els.tabs.forEach(tab => {
    tab.onclick = () => {
        const active = document.querySelector('.tab.active');
        if (active) active.classList.remove('active');
        tab.classList.add('active');
        currentView = tab.dataset.view || 'aggregates';
        render();
    }
});

// Initialization
// (Moved to bottom)

function getAllData(): { aggregates: Aggregate[], outbox: Event[], totalEvents: number } {
    const aggregates: Aggregate[] = [];
    let totalEvents = 0;

    // Scan LocalStorage for streams
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cqrs_events_')) {
            const raw = localStorage.getItem(key);
            const events: Event[] = raw ? JSON.parse(raw) : [];
            totalEvents += events.length;

            if (events.length > 0) {
                aggregates.push({
                    type: events[0].aggregateType,
                    id: events[0].aggregateId,
                    version: events[events.length - 1].version || 0,
                    key: key,
                    events: events
                });
            }
        }
    }

    const rawOutbox = localStorage.getItem('cqrs_outbox');
    const outbox: Event[] = rawOutbox ? JSON.parse(rawOutbox) : [];

    return { aggregates, outbox, totalEvents };
}

function render() {
    const data = getAllData();

    // Update Stats
    els.statAggregates.textContent = data.aggregates.length.toString();
    els.statEvents.textContent = data.totalEvents.toString();
    els.statOutbox.textContent = data.outbox.length.toString();
    if (data.outbox.length > 0) els.statOutbox.style.color = 'var(--danger)';
    else els.statOutbox.style.color = 'var(--text)';

    // Render Main Content
    els.content.innerHTML = '';

    if (currentView === 'aggregates') {
        const activeAggregates = data.aggregates.filter(agg => {
            const lastEvent = agg.events[agg.events.length - 1];
            return !lastEvent.eventType.endsWith('_DELETED');
        });

        const deletedCount = data.aggregates.length - activeAggregates.length;
        if (deletedCount > 0) {
            const notice = document.createElement('div');
            notice.style.padding = '10px';
            notice.style.opacity = '0.7';
            notice.style.fontSize = '0.9em';
            notice.textContent = `(Hiding ${deletedCount} deleted items)`;
            els.content.appendChild(notice);
        }

        renderAggregates(activeAggregates);
    } else if (currentView === 'outbox') {
        renderEventTable(data.outbox, 'Outbox is empty. All systems synchronized.');
    } else if (currentView === 'raw') {
        renderRawStorage();
    }
}

// --- Data Grid State (Moved to top) ---

// --- Column Picker Logic ---
const btnColumns = document.getElementById('btnColumns') as HTMLButtonElement;
let columnPickerDialog: HTMLElement | null = null;

btnColumns.onclick = (e) => {
    e.stopPropagation();
    if (!columnPickerDialog) {
        createColumnPicker();
    }
    columnPickerDialog!.classList.toggle('visible');
    updateColumnPicker();
};

document.addEventListener('click', (e) => {
    if (columnPickerDialog && !columnPickerDialog.contains(e.target as Node) && e.target !== btnColumns) {
        columnPickerDialog.classList.remove('visible');
    }
});

function createColumnPicker() {
    columnPickerDialog = document.createElement('div');
    columnPickerDialog.className = 'column-picker-dialog';
    document.body.appendChild(columnPickerDialog);
}

function updateColumnPicker() {
    if (!columnPickerDialog) return;

    // 1. Discover all possible columns
    const data = getAllData();
    const allKeys = new Set<string>(['id', 'type', 'version']);

    data.aggregates.forEach(agg => {
        const lastEvent = agg.events[agg.events.length - 1];
        if (lastEvent.payload) {
            Object.keys(lastEvent.payload).forEach(k => allKeys.add(k));
        }
    });

    // 2. Separate into "Visible" (Ordered) and "Available" (Unordered)
    // Filter out any visible columns that might no longer exist in data (optional, but good for cleanup)
    // actually, let's keep them in case they come back.

    const plainAvailable = Array.from(allKeys).filter(k => !visibleColumns.includes(k)).sort();

    columnPickerDialog.innerHTML = '';

    // --- Section 1: Visible (Ordered) ---
    const h4Vis = document.createElement('h4');
    h4Vis.style.margin = '0 0 5px 0';
    h4Vis.textContent = 'Visible Columns (Drag to Reorder)';
    columnPickerDialog.appendChild(h4Vis);

    visibleColumns.forEach((key, index) => {
        const row = document.createElement('div');
        row.className = 'column-option';
        row.style.background = '#333';
        row.style.padding = '4px 8px';
        row.style.marginBottom = '2px';
        row.style.borderRadius = '4px';
        row.draggable = true; // Enable Drag
        row.style.cursor = 'grab';

        // Checkbox (to hide)
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = true;
        const toggle = () => {
            visibleColumns = visibleColumns.filter(c => c !== key);
            saveAndRender();
        };
        chk.onchange = toggle;

        // Label
        const span = document.createElement('span');
        span.textContent = key;
        span.style.flex = '1';
        span.style.userSelect = 'none';

        // Drag & Drop Handlers
        row.ondragstart = (e) => {
            e.dataTransfer!.setData('text/plain', index.toString());
            e.dataTransfer!.effectAllowed = 'move';
            row.style.opacity = '0.5';
        };

        row.ondragover = (e) => {
            e.preventDefault(); // Necessary for drop to work
            e.dataTransfer!.dropEffect = 'move';
            row.style.border = '2px dashed var(--primary)';
        };

        row.ondragleave = (e) => {
            row.style.border = 'none';
        };

        row.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            row.style.border = 'none';
            row.style.opacity = '1';

            const fromIndex = parseInt(e.dataTransfer!.getData('text/plain'));
            const toIndex = index;

            if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                // Move Item
                const item = visibleColumns[fromIndex];
                visibleColumns.splice(fromIndex, 1);
                visibleColumns.splice(toIndex, 0, item);
                saveAndRender();
            }
        };

        row.ondragend = () => {
            row.style.opacity = '1';
            row.style.border = 'none';
        };

        row.appendChild(chk);
        row.appendChild(span);
        // Removed Arrow Buttons in favor of D&D
        columnPickerDialog!.appendChild(row);
    });

    // --- Section 2: Available (Hidden) ---
    if (plainAvailable.length > 0) {
        const h4Avail = document.createElement('h4');
        h4Avail.style.margin = '15px 0 5px 0';
        h4Avail.style.opacity = '0.7';
        h4Avail.textContent = 'Available Fields';
        columnPickerDialog.appendChild(h4Avail);

        plainAvailable.forEach(key => {
            const row = document.createElement('div');
            row.className = 'column-option';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = false;
            chk.onchange = () => {
                visibleColumns.push(key);
                saveAndRender();
            };

            const span = document.createElement('span');
            span.textContent = key;

            row.appendChild(chk);
            row.appendChild(span);
            columnPickerDialog!.appendChild(row);
        });
    }
}

function saveAndRender() {
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
    updateColumnPicker();
    render();
}

function renderAggregates(aggregates: Aggregate[]) {
    // ... (unchanged part of renderAggregates start) ...
    if (aggregates.length === 0) {
        els.content.innerHTML = '<div style="opacity:0.5; padding:20px; text-align:center">No data found. Click "Seed Example Data" to get started.</div>';
        return;
    }

    if (visibleColumns.length === 0) visibleColumns = ['id', 'type'];

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    visibleColumns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'dynamic-col';
        th.textContent = col.toUpperCase();
        trHead.appendChild(th);
    });

    const thAction = document.createElement('th');
    thAction.textContent = 'ACTIONS';
    thAction.style.width = '140px';
    thAction.style.textAlign = 'right';
    trHead.appendChild(thAction);

    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    aggregates.forEach(agg => {
        const tr = document.createElement('tr');
        const lastEvent = agg.events[agg.events.length - 1];
        const state = {
            id: agg.id,
            type: agg.type,
            version: agg.version,
            ...lastEvent.payload
        };

        visibleColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'dynamic-cell';
            const val = state[col];

            if (val === undefined || val === null) {
                td.textContent = '-';
                td.style.opacity = '0.3';
            } else if (typeof val === 'object') {
                td.textContent = '{...}';
                td.title = JSON.stringify(val, null, 2);
            } else {
                td.textContent = String(val);
                td.title = String(val);
            }
            td.ondblclick = () => window.editAggregate(agg.type, agg.id);
            tr.appendChild(td);
        });

        const tdAction = document.createElement('td');
        tdAction.style.textAlign = 'right';
        tdAction.innerHTML = `
            <button class="secondary" style="padding:2px 8px; font-size:0.8em" 
                onclick="alert('${agg.events.length} events:\\n' + JSON.stringify(${JSON.stringify(agg.events).replace(/"/g, "&quot;")}, null, 2))"
            >JSON</button>
            <button style="padding:2px 8px; font-size:0.8em; background:var(--primary)" 
                onclick="window.editAggregate('${agg.type}', '${agg.id}')"
            >✏️</button>
            <button class="danger" style="padding:2px 8px; font-size:0.8em" 
                onclick="window.deleteAggregate('${agg.type}', '${agg.id}')"
            >🗑️</button>
        `;
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    els.content.appendChild(table);
}


// ... (renderEventTable, renderRawStorage, global decls, modal setup - unchanged) ...
function renderEventTable(events: Event[], emptyMsg: string) {
    if (events.length === 0) {
        els.content.innerHTML = `<div style="opacity:0.5; padding:20px; text-align:center">${emptyMsg}</div>`;
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Event</th>
                <th>Payload</th>
            </tr>
        </thead>
        <tbody>
            ${events.map(e => `
                <tr>
                    <td style="font-size:0.8em; opacity:0.7">${new Date(e.timestamp || '').toLocaleTimeString()}</td>
                    <td>${e.aggregateType}</td>
                    <td><b>${e.eventType}</b></td>
                    <td><pre style="margin:0; font-size:0.8em; max-height:300px; white-space: pre-wrap;">${typeof e.payload === 'string'
            ? e.payload
            : JSON.stringify(e.payload, null, 2)
        }</pre></td>
                </tr>
            `).join('')}
        </tbody>
    `;
    els.content.appendChild(table);
}

function renderRawStorage() {
    let html = '';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key || '');
        html += `<div style="margin-bottom:20px">
            <div style="font-weight:bold; margin-bottom:5px; color:var(--primary)">${key}</div>
            <pre style="margin:0; font-size:0.8em">${val}</pre>
        </div>`;
    }
    els.content.innerHTML = html || 'LocalStorage is empty.';
}

declare global {
    interface Window {
        deleteAggregate: (type: string, id: string) => Promise<void>;
        editAggregate: (type: string, id: string) => Promise<void>;
        createNew: () => Promise<void>;
    }
}

const modal = document.getElementById('editorModal') as HTMLDialogElement;
const modalTitle = document.getElementById('modalTitle') as HTMLElement;
const modalType = document.getElementById('modalType') as HTMLInputElement;
const modalPayload = document.getElementById('modalPayload') as HTMLTextAreaElement;
const modalSaveBtn = document.getElementById('modalSaveParams') as HTMLButtonElement;

window.deleteAggregate = async (type: string, id: string) => {
    if (confirm(`Are you sure you want to DELETE this ${type}?\nID: ${id}`)) {
        await EventStore.writeEvent({
            aggregateId: id,
            aggregateType: type,
            eventType: `${type.toUpperCase()}_DELETED`,
            payload: { deletedAt: new Date().toISOString() }
        });
        await SyncEngine.sync();
        render();
    }
};

window.editAggregate = async (type: string, id: string) => {
    modalTitle.textContent = `Edit Entity: ${type}`;
    modalType.value = type;
    modalType.disabled = true;
    modalPayload.value = '{\n  "property": "value"\n}';
    modal.showModal();

    modalSaveBtn.onclick = async () => {
        try {
            const payload = JSON.parse(modalPayload.value);
            await EventStore.writeEvent({
                aggregateId: id,
                aggregateType: type,
                eventType: `${type.toUpperCase()}_UPDATED`,
                payload: payload
            });
            await SyncEngine.sync();
            modal.close();
            render();
        } catch (e: any) {
            alert('Invalid JSON: ' + e.message);
        }
    };
};

window.createNew = async () => {
    modalTitle.textContent = 'Create New Entity';
    modalType.value = 'page';
    modalType.disabled = false;
    modalPayload.value = '{\n  "title": "New Item"\n}';
    modal.showModal();

    modalSaveBtn.onclick = async () => {
        try {
            const type = modalType.value || 'item';
            const payload = JSON.parse(modalPayload.value);
            const newId = crypto.randomUUID();

            await EventStore.writeEvent({
                aggregateId: newId,
                aggregateType: type,
                eventType: `${type.toUpperCase()}_CREATED`,
                payload: payload
            });
            await SyncEngine.sync();
            modal.close();
            render();
        } catch (e: any) {
            alert('Invalid JSON: ' + e.message);
        }
    };
}

// Initialization
async function init() {
    // 0. Ensure dependencies are started correctly (Moved from top-level)
    SyncEngine.setBackendUrl('/api/events/sync');
    SyncEngine.start();

    // 1. Render data immediately if we have it
    render();

    // 2. Auto-Load from Disk (Server)
    console.log('Connecting to Backend Server...');

    try {
        const events = await SyncEngine.fetchRemoteEvents();
        if (events) {
            let count = 0;
            events.forEach((e: Event) => {
                EventStore.saveToStream(e);
                count++;
            });
            console.log(`Auto-loaded ${count} events.`);
            render();
        } else {
            console.warn('⚠️ Could not connect to Backend Server. (Is "npm run dev" running?)');
        }
    } catch (e: any) {
        console.error('Error connecting to server:', e);
    }
}

// Start App
init();
