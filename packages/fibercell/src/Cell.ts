import {conform} from './conform'
import {Fiber, FiberHost, FiberController} from './Fiber'
import {FiberCache} from './FiberCache'
import {hasDestructor, rollback, isPromise} from './utils'

export enum CellStatus {
    OBSOLETE = 'OBSOLETE',
    CHECKED = 'CHECKED',
    PENDING = 'PENDING',
    MOCK = 'MOCK',
}

export interface ICell {
    retry(all?: boolean): void
    abort(all?: boolean): void
    readonly pending: boolean
    readonly error: Error | void
}

const owners: WeakMap<Object, Cell<any>> = new WeakMap()

/**
 * Caches value, invokes pull/push value handler and manage cell fibers.
 */
export class Cell<V> implements FiberController, FiberHost, ICell {
    protected actual: V
    protected catched: Error | Promise<V> | void = undefined

    protected suggested: V = undefined
    protected status: CellStatus = CellStatus.OBSOLETE

    /**
     * Used for access current cell from fibers
     */
    static current: Cell<any> | void = undefined

    constructor(
        public readonly displayName: string,
        /**
         * @throws Promise<V> | Error
         **/
        protected get: () => V,
        /**
         * @throws Promise<V> | Error
         **/
        protected set: (next: V) => void,
        protected host: Object,
        protected dispose?: () => void,
    ) {}

    get pending(): boolean {
        return this.status === CellStatus.PENDING || this.status === CellStatus.MOCK
    }

    get error(): Error | void {
        return isPromise(this.catched) ? undefined : this.catched
    }

    toString() { return this.displayName }
    toJSON() { return this.actual }

    /**
     * Get/set actual value
     *
     * @throws Error | Promise<V>
     *
     * @param next suggested value
     */
    value(next?: V): V {
        this.reportObserved()
        if (next !== undefined) {
            let newSuggested: V = conform(next, this.suggested)
            if (newSuggested !== this.suggested) {
                newSuggested = conform(next, this.actual)
                if (newSuggested !== this.actual) {
                    this.suggested = newSuggested
                    this.status = CellStatus.OBSOLETE
                }
            }
        }

        if (this.status === CellStatus.OBSOLETE) this.actualize()
        if (this.status !== CellStatus.MOCK && this.catched) throw this.catched

        return this.actual
    }

    protected reportObserved() {}

    protected reportChanged() {}

    protected fibers: FiberCache | void = undefined

    fiber<K, V>(key: K, async?: boolean): Fiber<V> {
        if (!this.fibers) this.fibers = new FiberCache()
        return this.fibers.fiber(key, this, async)
    }

    /**
     * Destroys cell fibers: aborts cell-related async operations.
     * If is action cell, disables action restarts while not called by user again.
     */
    abort() {
        rollback(this.catched)
        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
        this.catched = undefined
        this.status = CellStatus.OBSOLETE
        this.reportChanged()
    }

    /**
     * Reset cell status to obsolete and report cell changes. Do not touches async operations in the cell fibers.
     */
    retry() {
        this.status = CellStatus.OBSOLETE
        this.reportChanged()
    }

    /**
     * Pass value from set handler to current cell.
     *
     * Used in mem.return if need to set another value than passed into set handler
     * 
     * @example ```ts
     * class Store {
     *   @mem set value(val: number) {
     *     if (val === 123) mem.return(321)
     *   }
     * }
     * ```
     */
    static result: any = undefined

    /**
     * Invokes value handler, updates status and actual value.
     */
    actualize(): void {
        const context = (this.constructor as typeof Cell)
        const host = Fiber.host
        Fiber.host = this
        context.result = undefined

        let isChanged = false

        const {status, suggested} = this
        try {
            let next: V = suggested === undefined
                ? this.get.call(this.host)
                : this.set.call(this.host, suggested)

            if (next === undefined) next = context.result
            if (next === undefined) next = suggested

            const actual: V = conform(next, this.actual)
            if (
                actual !== this.actual
                || status === CellStatus.PENDING
                || this.catched
            ) isChanged = true

            this.status = CellStatus.CHECKED
            this.actual = actual
            this.catched = undefined
            this.suggested = undefined
            if (this.fibers) this.fibers.destructor()
            this.fibers = undefined
            if (hasDestructor(actual) && !owners.has(actual)) owners.set(actual, this)
        } catch (error) {
            if (this.catched !== error) isChanged = true
            this.catched = error
            if (isPromise(error)) {
                // Suggest mock value, while loading on first run
                if (context.result !== undefined) {
                    if (this.actual === undefined) this.actual = context.result
                    this.status = CellStatus.MOCK
                } else {
                    this.status = CellStatus.PENDING
                }
            } else {
                if (this.fibers) this.fibers.destructor()
                this.fibers = undefined
                this.status = CellStatus.CHECKED
            }
        }

        context.result = undefined
        Fiber.host = host
        if (status !== this.status || isChanged) this.reportChanged()
    }

    destructor() {
        const actual = this.actual
        if (hasDestructor(actual) && owners.get(actual) === this) {
            owners.delete(actual)
            try {
                actual.destructor()
            } catch (error) {
                console.warn(`${this} error destructing ${actual}`, error)
            }
        }

        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
        if (this.dispose) this.dispose()
        this.actual = undefined
        this.status = CellStatus.OBSOLETE
        this.dispose = undefined
        this.get = undefined
        this.set = undefined
        this.host = undefined
        this.suggested = undefined
    }
}
