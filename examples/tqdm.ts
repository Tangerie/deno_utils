import { tqdm } from "@tangerie/utils/tqdm";
import { sleep } from "../internal/sleep.ts";

for await(const _ of tqdm(new Array(10), { label: "Single" })) {
    await sleep(100);
}

for await(const i of tqdm(new Array(10).fill(0).map((_, i) => i), { label: "Parent" })) {
    for await(const _ of tqdm(new Array(10), { label: "Child " + i })) {
        await sleep(100);
    }
}