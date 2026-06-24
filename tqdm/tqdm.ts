/* =============================================================================

    Tsqdm.

    A TQDM-style progress bar for TypeScript and Deno.

    Based off https://github.com/thesephist/tsqdm with modifications for my docker configuration and more

============================================================================= */

type RenderBarOptions = {
    i: number;
    label?: string;
    size?: number;
    width: number;
    elapsed: number;
};

export type TqdmOptions = {
    label?: string;
    size?: number;
    width?: number;
    /** Line slot for this bar (0 = top). Auto-assigned to the lowest free slot if omitted. */
    position?: number;
    /** Keep the bar on screen after completion. Default true; set false for inner bars. */
    leave?: boolean;
};

const markers = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
const filledMarker = markers.at(-1);

function formatTime(totalSeconds : number) {
    if (totalSeconds < 60) {
        return `${totalSeconds.toFixed(0)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Skip showing 0 seconds (e.g., "5m" instead of "5m 0s")
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds.toFixed(0)}s`;
}

function renderBarWithSize({
    i,
    label,
    size,
    width,
    elapsed,
}: RenderBarOptions & { size: number }): string {
    // size === 0 means "nothing to do" — render a full bar at 100%.
    const fraction = size > 0 ? i / size : 1;
    const n = Math.max(fraction * 8 * width, 0);
    const whole = Math.floor(n / 8);
    const rem = Math.round(n % 8);
    const bar = new Array(whole).fill(filledMarker).join("") + markers[rem];
    const gap = new Array(Math.max(width - bar.length, 0)).fill(" ").join("");
    const rate = elapsed > 0 ? i / elapsed : 0;
    const remaining = rate > 0 ? (size - i) / rate : Infinity;
    const percent = fraction * 100;
    const graph = `${label ? label + ": " : ""}${percent.toFixed(
        1,
    )}% |${bar}${gap}| ${i}/${size} | ${formatTime(elapsed)}>${
        Number.isFinite(remaining) ? formatTime(remaining) : "?"
    } ${rate.toFixed(2)}it/s`;
    if (graph === "" && n > 0) {
        return "▏";
    }
    return graph;
}

function renderBarWithoutSize({
    i,
    label,
    elapsed,
}: Omit<RenderBarOptions, "size">): string {
    const rate = elapsed > 0 ? i / elapsed : 0;
    const graph = `${label ? label + ": " : ""}${i} | ${elapsed.toFixed(
        2,
    )}s ${rate.toFixed(2)}it/s`;
    if (graph === "" && i > 0) {
        return "▏";
    }
    return graph;
}

/**
 * TQDM bar rendering logic extracted out for easy testing and modularity.
 * Renders the full bar string given all necessary inputs.
 */
function renderBar({ size, ...options }: RenderBarOptions): string {
    if (size === undefined) {
        return renderBarWithoutSize({ ...options });
    }
    return renderBarWithSize({ size, ...options });
}

function* arrayToIterableIterator<T>(iter: T[]): IterableIterator<T> {
    yield* iter;
}

function isIterableIterator<T>(
    value: IterableIterator<T> | AsyncIterableIterator<T>,
): value is IterableIterator<T> {
    return (
        value != null &&
        typeof (value as IterableIterator<T>)[Symbol.iterator] === "function" &&
        typeof value.next === "function"
    );
}

async function* toAsyncIterableIterator<T>(
    iter: IterableIterator<T>,
): AsyncIterableIterator<T> {
    for (const it of iter) {
        yield it;
    }
}

function unreachable(x: never): never {
    throw new Error(`Unreachable: ${x}`);
}

class Writer {
    private runtime: "deno" | "node";
    private encoder = new globalThis.TextEncoder();

    constructor() {
        if ((globalThis as any).Deno) {
            this.runtime = "deno";
        } else if ((globalThis as any).process) {
            this.runtime = "node";
        } else {
            throw new Error("Unsupported runtime");
        }
    }

    async write(s: string): Promise<void> {
        if (this.runtime === "deno") {
            await (globalThis as any).Deno.stdout.write(this.encoder.encode(s));
        } else if (this.runtime === "node") {
            await (globalThis as any).process.stdout.write(s);
        } else {
            unreachable(this.runtime);
        }
    }
}

function isTerminal(): boolean {
    const d = (globalThis as any).Deno;
    if (d?.stdout?.isTerminal) return d.stdout.isTerminal();
    const proc = (globalThis as any).process;
    if (proc?.stdout) return Boolean(proc.stdout.isTTY);
    return false;
}

const IS_TERMINAL = isTerminal();

/**
 * Owns the multi-line bar block. Bars acquire a position (line slot),
 * render into it via cursor movement, and release it when done.
 * Cursor convention: always parked at column 1 on the line *below* the block.
 */
class BarManager {
    private static _instance?: BarManager;
    static get instance(): BarManager {
        return (this._instance ??= new BarManager());
    }

    private writer = new Writer();
    private occupied = new Set<number>();
    private height = 0;
    private chain: Promise<void> = Promise.resolve();
    
    /** Serialize writes so concurrent bars can't interleave escape sequences. */
    private enqueue(fn: () => Promise<void>): Promise<void> {
        this.chain = this.chain.then(fn, fn);
        return this.chain;
    }

    acquire(position?: number): number {
        let pos = position ?? 0;
        if (position === undefined) {
            while (this.occupied.has(pos)) pos++;
        }
        this.occupied.add(pos);
        return pos;
    }

    render(pos: number, text: string): Promise<void> {
        return this.enqueue(async () => {
            if (!IS_TERMINAL) {
                // No cursor games in dumb terminals / log collectors: append-only.
                await this.writer.write(text + "\n");
                return;
            }
            // Grow the block downward until the slot exists.
            while (this.height < pos + 1) {
                await this.writer.write("\n");
                this.height++;
            }
            const up = this.height - pos;
            await this.writer.write(
                `\x1b[${up}A` +   // jump up to the slot's line
                "\x1b[2K\x1b[1G" + // clear it, column 1
                text +
                `\x1b[${up}B\x1b[1G`, // park below the block again
            );
        });
    }

    release(pos: number, leave: boolean): Promise<void> {
        return this.enqueue(async () => {
            this.occupied.delete(pos);
            if (IS_TERMINAL && !leave && pos < this.height) {
                const up = this.height - pos;
                await this.writer.write(`\x1b[${up}A\x1b[2K\x1b[${up}B\x1b[1G`);
            }
            // When the whole block is done, reset so the next batch starts fresh.
            if (this.occupied.size === 0) this.height = 0;
        });
    }
}


/**
 * A TQDM progress bar for an arbitrary `AsyncIterableIterator<T>`.
 *
 * Note that unlike in Python, here we need to manually specify the total size
 * of the iterable.
 */
export async function* tqdm<T>(
    iter: Array<T> | IterableIterator<T> | AsyncIterableIterator<T>,
    { label, size, width = 16, position, leave = true }: TqdmOptions = {},
): AsyncIterableIterator<T> {
    if (Array.isArray(iter)) {
        size = iter.length;
        iter = arrayToIterableIterator(iter);
    }
    if (isIterableIterator(iter)) {
        iter = toAsyncIterableIterator(iter);
    }

    const mgr = BarManager.instance;
    const pos = mgr.acquire(position);
    const start = Date.now();
    let i = 0;
    
    const paint = () => {
        const elapsed = (Date.now() - start) / 1000;
        return mgr.render(pos, renderBar({ i, label, size, width, elapsed }));
    };

    try {
        await paint(); // empty bar, immediately
        for await (const it of iter) {
            yield it;
            i++;
            await paint();
        }
    } finally {
        await mgr.release(pos, leave);
    }
}