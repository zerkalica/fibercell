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

export const schedule: (handler: () => void) => any =
    typeof requestAnimationFrame == 'function'
        ? handler => requestAnimationFrame(handler)
        : handler => setTimeout(handler, 16)

/** 
 * @throws Error | Promise
 */
export function rethrow(e: Error | Promise<any> | any) {
    /**
     * Setup "Never pause here" in chrome devtools debugger
     *
     * @see https://medium.com/@theroccob/never-pause-here-undoing-breakpoints-in-chrome-devtools-97e64cd06086
     */
    throw e
}
