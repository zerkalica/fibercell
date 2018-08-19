export function getId(t: Object, hk: string): string {
    return `${(t.constructor as any).displayName || t.constructor.name}.${hk}`;
}

export function isPromise(target: any): target is Promise<any> {
    return target !== null && typeof target === 'object' && typeof target.then === 'function'
}

export function setFunctionName<F extends Function>(fn: F, name: string): F {
    Object.defineProperty(fn, 'name', { value: name, writable: false })
    ;(fn as any).displayName = name

    return fn
}

export function bind<F extends Function>(t: Object, fn: F, name: string): F {
    return setFunctionName(fn.bind(t), name)
}

const origId = Symbol('lom_error_orig')
const throwOnAccess: ProxyHandler<any> = {
    get<V extends Object>(target: Error, key: string | symbol): V {
        if (key === origId) return target.valueOf() as V
        throw target.valueOf()
    },
    ownKeys(target: Error): string[] {
        throw target.valueOf()
    }
}

export function proxify<V extends Object>(v: V): V {
    return v[origId] ? v : new Proxy(v, throwOnAccess) as any
}

export function unproxify<V extends Object>(v: V): V {
    return v[origId] || v
}

export function hasDestructor(obj: any): obj is {destructor(): void} {
    return obj && typeof obj === 'object' && typeof unproxify(obj).destructor === 'function'
}

const rollbackKey = Symbol('rollback')

/**
 * @throws Error | Promise<any>
 */
export function rollback(rawData: void | Error | Promise<any>, cb?: (() => void)): void {
    if (!rawData) return
    const data = unproxify(rawData)
    if (cb) {
        const prev = data[rollbackKey]
        data[rollbackKey] = prev
            ? () => {
                prev()
                cb()
            }
            : cb

        throw rawData
    }
    if (!data || typeof data !== 'object' || !data[rollbackKey]) return
    try {
        data[rollbackKey]()
    } catch (error) {
        console.warn(error)
    }
}
