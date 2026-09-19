// Cross-tab chat DB sync relay, served from /db-sync.worker.js (apps/web/public).
// Plain JS on purpose: public/ files are served as-is with no bundling.
// A SharedWorker is used so every tab shares one relay instead of N direct links.

const connections = new Set();
const broadcastChannel = new BroadcastChannel('chat-sync-channel');

self.onconnect = event => {
    const port = event.ports[0];
    connections.add(port);

    port.onmessage = e => {
        handleMessage(e.data, port);
    };

    port.start();

    port.addEventListener('close', () => {
        connections.delete(port);
    });

    port.postMessage({ type: 'connected' });
};

broadcastChannel.onmessage = event => {
    for (const port of Array.from(connections)) {
        port.postMessage(event.data);
    }
};

function handleMessage(message, sourcePort) {
    if (!message || !message.type) return;
    for (const port of Array.from(connections)) {
        if (port !== sourcePort) {
            port.postMessage(message);
        }
    }
}
