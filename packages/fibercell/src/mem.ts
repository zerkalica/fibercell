import {Cell, ICell} from './Cell'
import {cellDecorator, cellDecoratorState, CellProperty} from './cellDecorator'
import {actionDecorator} from './actions'
import {rollback} from './utils'
/**
 * Public API cell facade
 */
export interface IMem {
    /**
     * Observable, computed, pullable, pushable property decorator.
     * 
     * @example
     * ```ts
     * class TodoRepository {
     *   @mem counter = 0 // like @mobx.observable
     *   @mem get num(): number { return this.counter + 1} // computed
     * 
     *   @mem get text(): string { return fetchJson(...) } // pull text from server
     *   @mem set text(next: string) {}
     * }
     * ```
     */
    <V extends CellProperty<V>>(proto: Object, name: string, descr: TypedPropertyDescriptor<V>): TypedPropertyDescriptor<V>

    action: typeof actionDecorator // <Target, Method extends ActionMethod>ActionDecorator<Target, Method>

    /**
     * Check cell raw value. Used for restarting pending actions and for accessing cell status.
     *
     * @param v tracking property
     */
    state(v: any): ICell

    /**
     * Reset cell status and report changed.
     *
     * @example
     * ```ts
     * class TodoRepository {
     *     @mem get todos(): Todo[] {
     *         return fetchJson('/todos')
     *     }
     *     set todos(data: Todo[]) {}
     *     reload() { mem.retry(this.todos) }
     * }
     * ```
     */
    retry<V>(v: V): void

    /**
     * Used inside set handler to suggest new value instead of pushed.
     *
     * @example ```ts
     * class Store {
     *   @mem set value(val: number) {
     *     mem.return(321)
     *     mem.return(fetchJson(val))
     *   }
     * }
     * ```
     */
    suggest<V>(v: V): V


    /**
     * Suggests rollback handler and throw error
     *
     * @throws Error | Promise<any>
     */
    throwRollback(v: Error | Promise<any>, cb: () => void): void
}

/**
 * Public API facade
 */
export const mem = cellDecorator as IMem
mem.action = actionDecorator
mem.throwRollback = rollback
mem.suggest = <V>(v: V) => {
    Cell.result = v
    return v
}

function checkNoBind(t: Object) {
    if (t !== mem) throw new Error('Do not bind mem methods')
    cellDecoratorState.returnCell = false
}

function callRetry<V>(cell: Cell<V>): void {
    checkNoBind(this)
    cell.retry()
}

function pass<V>(v: any): V {
    checkNoBind(this)
    return v
}


Object.defineProperties(mem, {
    retry: {
        get() {
            cellDecoratorState.returnCell = true
            return callRetry
        }
    },
    state: {
        get() {
            cellDecoratorState.returnCell = true
            return pass
        }
    }
})
