import {Cell} from './Cell'
import {cellDecorator, CellDecorator} from './cellDecorator'
import {cellKeyDecorator} from './cellKeyDecorator'
import {action} from './actions'
import {rollback} from './utils'

/**
 * Public API cell facade
 */
export interface IMem extends CellDecorator {
    action: typeof action
    key: typeof cellKeyDecorator

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
mem.action = action
mem.key = cellKeyDecorator
mem.throwRollback = rollback
mem.suggest = <V>(v: V) => {
    Cell.result = v
    return v
}
