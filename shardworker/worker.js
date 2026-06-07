// SharedWorker：多 tab 共享的任务调度器
const clients = new Map(); // port -> { id, label }
let clientSeq = 0;

const tasks = new Map(); // taskId -> { status, progress, result, error }

self.onconnect = (event) => {
    const port = event.ports[0];
    const clientId = `client-${++clientSeq}`;

    clients.set(port, { id: clientId, label: clientId });
    port.start();

    port.onmessage = (event) => handleMessage(port, event.data);
    port.onmessageerror = () => {
        postToPort(port, { type: 'error', error: '消息无法反序列化' });
    };

    postToPort(port, {
        type: 'connected',
        clientId,
        clientCount: clients.size,
        pendingTasks: [...tasks.values()].filter((t) => t.status === 'running'),
    });
};

function handleMessage(port, data) {
    const { type, taskId, payload = {} } = data || {};

    switch (type) {
        case 'ping':
            postToPort(port, { type: 'pong', at: Date.now() });
            break;

        case 'setLabel':
            if (clients.has(port)) {
                clients.get(port).label = payload.label || clients.get(port).id;
            }
            broadcast({ type: 'clients', clients: getClientList() });
            break;

        case 'runTask':
            runTask(port, taskId || `task-${Date.now()}`, payload);
            break;

        case 'cancelTask':
            cancelTask(taskId);
            break;

        case 'getState':
            postToPort(port, {
                type: 'state',
                clients: getClientList(),
                tasks: serializeTasks(),
            });
            break;

        default:
            postToPort(port, { type: 'error', error: `未知指令: ${type}` });
    }
}

function getClientList() {
    return [...clients.values()].map(({ id, label }) => ({ id, label }));
}

function serializeTasks() {
    return [...tasks.entries()].map(([id, task]) => ({ id, ...task }));
}

function postToPort(port, message) {
    port.postMessage(message);
}

function broadcast(message, exceptPort) {
    for (const port of clients.keys()) {
        if (port !== exceptPort) {
            postToPort(port, message);
        }
    }
}

function broadcastAll(message) {
    for (const port of clients.keys()) {
        postToPort(port, message);
    }
}

function runTask(requestPort, taskId, payload) {
    const { name, input } = payload;

    if (tasks.has(taskId) && tasks.get(taskId).status === 'running') {
        postToPort(requestPort, {
            type: 'taskRejected',
            taskId,
            error: '任务已在执行',
        });
        return;
    }

    const task = {
        status: 'running',
        progress: 0,
        name,
        requestedBy: clients.get(requestPort)?.label,
        startedAt: Date.now(),
    };
    tasks.set(taskId, task);

    broadcastAll({
        type: 'taskStarted',
        taskId,
        task: { ...task },
    });

    switch (name) {
        case 'fibonacci':
            runFibonacci(taskId, Number(input?.n ?? 45));
            break;
        case 'batchTransform':
            runBatchTransform(taskId, input?.items || []);
            break;
        case 'parseLargeJson':
            runParseLargeJson(taskId, input?.size ?? 50000);
            break;
        default:
            failTask(taskId, `不支持的任务: ${name}`);
    }
}

function updateTask(taskId, patch) {
    const task = tasks.get(taskId);
    if (!task) return;
    Object.assign(task, patch);
    broadcastAll({ type: 'taskProgress', taskId, task: { ...task } });
}

function finishTask(taskId, result) {
    updateTask(taskId, { status: 'done', progress: 100, result, finishedAt: Date.now() });
}

function failTask(taskId, error) {
    updateTask(taskId, { status: 'error', error, finishedAt: Date.now() });
}

function cancelTask(taskId) {
    const task = tasks.get(taskId);
    if (!task || task.status !== 'running') return;
    task.cancelled = true;
    failTask(taskId, '任务已取消');
}

// 复杂任务 1：斐波那契（CPU 密集，分步汇报进度）
function runFibonacci(taskId, n) {
    if (!Number.isFinite(n) || n < 0 || n > 45) {
        // failTask(taskId, 'n 需在 0~45 之间');
        // return;
    }

    let a = 0;
    let b = 1;
    const total = Math.max(n, 1);

    for (let i = 0; i <= n; i += 1) {
        if (tasks.get(taskId)?.cancelled) return;

        if (i === 0) {
            a = 0;
        } else if (i === 1) {
            b = 1;
        } else {
            const next = a + b;
            a = b;
            b = next;
        }

        if (i % 5 === 0 || i === n) {
            updateTask(taskId, {
                progress: Math.round((i / total) * 100),
                partial: { step: i, value: i <= 1 ? i : b },
            });
        }
    }

    finishTask(taskId, { n, result: b });
}

// 复杂任务 2：批量数据转换（模拟业务批处理）
function runBatchTransform(taskId, items) {
    if (!Array.isArray(items) || items.length === 0) {
        failTask(taskId, 'items 不能为空');
        return;
    }

    const output = [];
    const total = items.length;

    for (let i = 0; i < total; i += 1) {
        if (tasks.get(taskId)?.cancelled) return;

        const raw = items[i];
        output.push({
            id: raw.id,
            normalized: String(raw.name || '').trim().toLowerCase(),
            score: Number(raw.score || 0) * 1.1,
            tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
        });

        if (i % 10 === 0 || i === total - 1) {
            updateTask(taskId, {
                progress: Math.round(((i + 1) / total) * 100),
                partial: { processed: i + 1, total },
            });
        }
    }

    finishTask(taskId, { count: output.length, items: output });
}

// 复杂任务 3：构造并解析大 JSON（内存 + parse 开销）
function runParseLargeJson(taskId, size) {
    if (!Number.isFinite(size) || size < 1000 || size > 200000) {
        failTask(taskId, 'size 需在 1000~200000 之间');
        return;
    }

    updateTask(taskId, { progress: 10, partial: { phase: 'building' } });

    const rows = [];
    for (let i = 0; i < size; i += 1) {
        if (tasks.get(taskId)?.cancelled) return;
        rows.push({ id: i, value: `row-${i}`, ok: i % 7 === 0 });

        if (i % 5000 === 0) {
            updateTask(taskId, {
                progress: 10 + Math.round((i / size) * 40),
                partial: { phase: 'building', built: i },
            });
        }
    }

    updateTask(taskId, { progress: 55, partial: { phase: 'stringify' } });
    const json = JSON.stringify({ rows, meta: { size, createdAt: Date.now() } });

    updateTask(taskId, { progress: 75, partial: { phase: 'parse', bytes: json.length } });
    const parsed = JSON.parse(json);

    finishTask(taskId, {
        rowCount: parsed.rows.length,
        bytes: json.length,
        validRows: parsed.rows.filter((r) => r.ok).length,
    });
}
