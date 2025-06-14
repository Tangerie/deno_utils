export type SingleOrMany<T> = Array<T> | T;

export function asArray<T>(data : SingleOrMany<T>) {
    return Array.isArray(data) ? data : [data];
}

export async function *asyncIterMap<I, O>(generator : AsyncGenerator<I>, fn : (item : I, index : number) => O | Promise<O>) {
    let i = 0;
    for await(const item of generator) {
        yield await fn(item, i);
        i++;
    }
}