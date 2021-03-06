import {unproxifyError} from './proxify'

export function getId(t: Object, hk: string | symbol): string {
    return `${(t.constructor as any).displayName || t.constructor.name}.${hk.toString()}`;
}

export function isPromise(target: any): target is Promise<any> {
    return target !== null && typeof target === 'object' && typeof target.then === 'function'
}

export function setFunctionName<F extends Function>(fn: F, name: string): F {
    Object.defineProperty(fn, 'name', { value: name, writable: false })
    ;(fn as any).displayName = name

    return fn
}

export function hasDestructor(obj: any): obj is {destructor(): void} {
    return obj && typeof obj === 'object' && typeof unproxifyError(obj).destructor === 'function'
}
