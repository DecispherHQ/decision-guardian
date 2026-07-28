export interface Env {
    TELEMETRY_KV: KVNamespace;
    STATS_SECRET: string;
}

interface TelemetryEvent {
    event: string;
    schema?: number;
    version: string;
    source: string;
    timestamp: string;
    repo_hash?: string | null;
    repo_visibility?: 'public' | 'private' | null;
    event_name?: string | null;
    metrics: {
        files_processed: number;
        decisions_evaluated: number;
        matches_found: number;
        critical_matches: number;
        warning_matches: number;
        info_matches: number;
        duration_ms: number;
    };
    environment: {
        node_version: string;
        os_platform: string;
        ci: boolean;
    };
}

/** Repo hashes are 16 lowercase hex chars. Anything else is rejected, not stored. */
const REPO_HASH_PATTERN = /^[a-f0-9]{16}$/;

const DAY_SECONDS = 24 * 60 * 60;
const AGGREGATE_TTL = 90 * DAY_SECONDS;
const SEEN_TTL = 400 * DAY_SECONDS;

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
            return handleStats(request, env);
        }

        return corsResponse(404, { error: 'Not found' });
    },
};

async function handleCollect(request: Request, env: Env): Promise<Response> {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) {
        return corsResponse(413, { error: 'Payload too large' });
    }

    try {
        const body = (await request.json()) as TelemetryEvent;

        if (!body.event || !body.version || !body.source) {
            return corsResponse(400, { error: 'Missing required fields' });
        }

        if (
            body.repo_hash !== undefined &&
            body.repo_hash !== null &&
            !REPO_HASH_PATTERN.test(body.repo_hash)
        ) {
            return corsResponse(400, { error: 'Malformed repo_hash' });
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `events:${today}`;

        const existing = await env.TELEMETRY_KV.get(key, 'json') as Partial<DailyAggregate> | null;
        const aggregate = normalizeAggregate(existing, today);

        aggregate.total_runs++;
        aggregate.sources[body.source] = (aggregate.sources[body.source] || 0) + 1;
        aggregate.versions[body.version] = (aggregate.versions[body.version] || 0) + 1;

        if (body.repo_visibility) {
            aggregate.visibility[body.repo_visibility] =
                (aggregate.visibility[body.repo_visibility] || 0) + 1;
        }

        if (body.event_name) {
            aggregate.events[body.event_name] = (aggregate.events[body.event_name] || 0) + 1;
        }

        const nodeMajor = parseNodeMajor(body.environment?.node_version);
        if (nodeMajor) {
            aggregate.node_majors[nodeMajor] = (aggregate.node_majors[nodeMajor] || 0) + 1;
        }

        if (body.environment?.os_platform) {
            const platform = body.environment.os_platform;
            aggregate.platforms[platform] = (aggregate.platforms[platform] || 0) + 1;
        }

        if (body.metrics) {
            aggregate.total_files += body.metrics.files_processed || 0;
            aggregate.total_matches += body.metrics.matches_found || 0;
            aggregate.total_decisions += body.metrics.decisions_evaluated || 0;
        }

        await env.TELEMETRY_KV.put(key, JSON.stringify(aggregate), {
            expirationTtl: AGGREGATE_TTL,
        });

        if (body.repo_hash) {
            await env.TELEMETRY_KV.put(`seen:${today}:${body.repo_hash}`, body.source, {
                expirationTtl: SEEN_TTL,
            });
        }

        return corsResponse(200, { status: 'ok' });
    } catch (error) {
        console.error('collect failed', {
            message: error instanceof Error ? error.message : String(error),
        });
        return corsResponse(500, { error: 'Internal error' });
    }
}

async function handleStats(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('X-Stats-Key');
    if (authHeader !== env.STATS_SECRET) {
        return corsResponse(401, { error: 'Unauthorized' });
    }

    const keys = await env.TELEMETRY_KV.list({ prefix: 'events:' });
    const results: DailyAggregate[] = [];

    for (const key of keys.keys) {
        const val = await env.TELEMETRY_KV.get(key.name, 'json') as DailyAggregate | null;
        if (val) results.push(val);
    }

    const activity = await readRepoActivity(env);

    const sorted = results.sort((a, b) => b.date.localeCompare(a.date));
    const last30 = sorted.slice(0, 30).map((r) => ({
        ...r,
        unique_repos: activity.reposByDay.get(r.date)?.size ?? 0,
        new_repos: activity.newReposByDay.get(r.date) ?? 0,
    }));

    const summary = {
        days: results.length,
        total_runs: results.reduce((s, r) => s + r.total_runs, 0),
        total_files: results.reduce((s, r) => s + r.total_files, 0),
        total_matches: results.reduce((s, r) => s + r.total_matches, 0),
        counters_are_floor: true,
        unique_repos_all_time: activity.firstSeenByRepo.size,
        active_repos_7d: countActiveRepos(activity.reposByDay, 7),
        active_repos_30d: countActiveRepos(activity.reposByDay, 30),
        daily: last30,
    };

    return corsResponse(200, summary);
}

interface RepoActivity {
    reposByDay: Map<string, Set<string>>;
    firstSeenByRepo: Map<string, string>;
    newReposByDay: Map<string, number>;
}

async function readRepoActivity(env: Env): Promise<RepoActivity> {
    const reposByDay = new Map<string, Set<string>>();
    const firstSeenByRepo = new Map<string, string>();

    let cursor: string | undefined;
    do {
        const page = await env.TELEMETRY_KV.list({ prefix: 'seen:', cursor });

        for (const key of page.keys) {
            const [, date, hash] = key.name.split(':');
            if (!date || !hash) continue;

            let repos = reposByDay.get(date);
            if (!repos) {
                repos = new Set();
                reposByDay.set(date, repos);
            }
            repos.add(hash);

            const earliest = firstSeenByRepo.get(hash);
            if (!earliest || date < earliest) {
                firstSeenByRepo.set(hash, date);
            }
        }

        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    const newReposByDay = new Map<string, number>();
    for (const date of firstSeenByRepo.values()) {
        newReposByDay.set(date, (newReposByDay.get(date) ?? 0) + 1);
    }

    return { reposByDay, firstSeenByRepo, newReposByDay };
}

function countActiveRepos(reposByDay: Map<string, Set<string>>, days: number): number {
    const cutoff = new Date(Date.now() - days * DAY_SECONDS * 1000).toISOString().split('T')[0];
    const active = new Set<string>();

    for (const [date, repos] of reposByDay) {
        if (date >= cutoff) {
            for (const repo of repos) active.add(repo);
        }
    }

    return active.size;
}

interface DailyAggregate {
    date: string;
    total_runs: number;
    total_files: number;
    total_matches: number;
    total_decisions: number;
    sources: Record<string, number>;
    versions: Record<string, number>;
    visibility: Record<string, number>;
    events: Record<string, number>;
    node_majors: Record<string, number>;
    platforms: Record<string, number>;
}

function parseNodeMajor(nodeVersion: string | undefined): string | null {
    if (!nodeVersion) return null;

    const match = nodeVersion.match(/^v?(\d+)\./);
    return match ? match[1] : null;
}

function normalizeAggregate(stored: Partial<DailyAggregate> | null, date: string): DailyAggregate {
    const empty = createEmptyAggregate(date);
    if (!stored) return empty;

    return {
        ...empty,
        ...stored,
        date: stored.date || date,
        sources: stored.sources || empty.sources,
        versions: stored.versions || empty.versions,
        visibility: stored.visibility || empty.visibility,
        events: stored.events || empty.events,
        node_majors: stored.node_majors || empty.node_majors,
        platforms: stored.platforms || empty.platforms,
    };
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
        visibility: {},
        events: {},
        node_majors: {},
        platforms: {},
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
