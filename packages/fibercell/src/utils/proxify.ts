const origId = Symbol('orig_error')
const throwOnAccess: ProxyHandler<any> = {
    get<V extends Object>(target: Error, key: string | symbol): V {
        if (key === origId) return target.valueOf() as V
        throw target.valueOf()
    },
    ownKeys(target: Error): string[] {
        throw target.valueOf()
    }
}

export function proxifyError<V extends Object, O extends Object>(v: V): O {
    return v[origId] ? v : new Proxy(v, throwOnAccess) as any
}

export function unproxifyError<V extends Object>(v: V): V {
    return v[origId] || v
}
