import { tqdm } from "./tqdm.ts";

async function* range(start: number, end : number): AsyncIterableIterator<number> {
    for (let i = start; i < end; i++) {
        yield i;
    }
}

export function trange(start : number, end : number): AsyncIterableIterator<number> {
    return tqdm(range(start, end), { size: end - start })
}