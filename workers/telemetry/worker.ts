export interface Env {
    TELEMETRY_KV: KVNamespace;
}

interface TelemetryEvent {
    event: string;
    version: string;
    source: string;
    timestamp: string;
    metrics: Record<string, number>;
    environment: Record<string, unknown>;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return corsResponse(204);
        }

        if (url.pathname === '/collect' && request.method === 'POST') {
            return handleCollect(request, env);
        }

        if (url.pathname === '/stats' && request.method === 'GET') {
            return handleStats(env);
        }

        return corsResponse(404, { error: 'Not found' });
    },
};

async function handleCollect(request: Request, env: Env): Promise<Response> {
    try {
        const body = (await request.json()) as TelemetryEvent;

        if (!body.event || !body.version || !body.source) {
            return corsResponse(400, { error: 'Missing required fields' });
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `events:${today}`;

        const existing = await env.TELEMETRY_KV.get(key, 'json') as DailyAggregate | null;
        const aggregate: DailyAggregate = existing || createEmptyAggregate(today);

        aggregate.total_runs++;
        aggregate.sources[body.source] = (aggregate.sources[body.source] || 0) + 1;
        aggregate.versions[body.version] = (aggregate.versions[body.version] || 0) + 1;

        if (body.metrics) {
            aggregate.total_files += body.metrics.files_processed || 0;
            aggregate.total_matches += body.metrics.matches_found || 0;
            aggregate.total_decisions += body.metrics.decisions_evaluated || 0;
        }

        // TTL: 90 days
        await env.TELEMETRY_KV.put(key, JSON.stringify(aggregate), {
            expirationTtl: 90 * 24 * 60 * 60,
        });

        return corsResponse(200, { status: 'ok' });
    } catch {
        return corsResponse(500, { error: 'Internal error' });
    }
}

async function handleStats(env: Env): Promise<Response> {
    const keys = await env.TELEMETRY_KV.list({ prefix: 'events:' });
    const results: DailyAggregate[] = [];

    for (const key of keys.keys) {
        const val = await env.TELEMETRY_KV.get(key.name, 'json') as DailyAggregate | null;
        if (val) results.push(val);
    }

    const summary = {
        days: results.length,
        total_runs: results.reduce((s, r) => s + r.total_runs, 0),
        total_files: results.reduce((s, r) => s + r.total_files, 0),
        total_matches: results.reduce((s, r) => s + r.total_matches, 0),
        daily: results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    };

    return corsResponse(200, summary);
}

interface DailyAggregate {
    date: string;
    total_runs: number;
    total_files: number;
    total_matches: number;
    total_decisions: number;
    sources: Record<string, number>;
    versions: Record<string, number>;
}

function createEmptyAggregate(date: string): DailyAggregate {
    return {
        date,
        total_runs: 0,
        total_files: 0,
        total_matches: 0,
        total_decisions: 0,
        sources: {},
        versions: {},
    };
}

function corsResponse(status: number, body?: unknown): Response {
    return new Response(body ? JSON.stringify(body) : null, {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
