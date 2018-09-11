import {Cell} from './Cell'

function cellToValue<K, V>(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    valueMap: ReadonlyMap<K, V>
): (value: Cell<V>, key: K, map: ReadonlyMap<K, Cell<V>>) => void {
    return function(value: Cell<V>, key: K, map: ReadonlyMap<K, Cell<V>>) {
        callbackfn(value.value(), key, valueMap)
    }
}

function makeIterable<T>(iterator: Iterator<T>): IterableIterator<T> {
    iterator[Symbol.iterator] = self
    return iterator as any
}

function self() {
    return this
}

class ValueMap<K, V> implements ReadonlyMap<K, V> {
    constructor(private orig: Map<K, Cell<V>>) {}

    forEach(
        callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
        thisArg?: any
    ): void {
        return this.orig.forEach(cellToValue(callbackfn, this), thisArg)
    }

    get(key: K): V | undefined {
        return this.orig.get(key).value()
    }

    has(key: K): boolean {
        return this.orig.has(key)
    }

    get size(): number {
        return this.orig.size
    }

    keys(): IterableIterator<K> {
        return this.orig.keys()
    }

    values(): IterableIterator<V> {
        const self = this
        let nextIndex = 0
        const keys = Array.from(this.keys())
        return makeIterable<V>({
            next() {
                return nextIndex < keys.length
                    ? { value: self.get(keys[nextIndex++]), done: false }
                    : { done: true }
            }
        } as any)
    }

    entries(): IterableIterator<[K, V]> {
        const self = this
        let nextIndex = 0
        const keys = Array.from(this.keys())
        return makeIterable({
            next: function() {
                if (nextIndex < keys.length) {
                    const key = keys[nextIndex++]
                    return {
                        value: [key, self.get(key)!] as [K, V],
                        done: false
                    }
                }
                return { done: true }
            }
        } as any)
    }

    [Symbol.iterator]() {
        return this.entries()
    }
}

export function toValueMap<K, V>(cellMap: Map<K, Cell<V>>): ReadonlyMap<K, V> {
    return new ValueMap(cellMap)
}
