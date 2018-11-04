import {Cell} from './Cell'
import {setFunctionName} from './utils'

export type CellProperty<V> = ((a: any, ...args: any[]) => any) extends V ? never : any

export const cellDecoratorState: {
    returnCell: boolean,
    returnMap: boolean,
    FiberCell: typeof Cell
} = {
    returnCell: false,
    returnMap: false,
    FiberCell: Cell,
}

export function setupCellClass(NewCell: typeof Cell) {
    cellDecoratorState.FiberCell = NewCell
}

function valueGet<V>(): any {}
function valueSet<V>(next?: V): any { return next }

/**
 * @throws Error | Promise
 */
function cleanCell<V>(
    cells: WeakMap<Object, Cell<V>>,
    /**
     * @throws Error | Promise
     */
    destructor?: void | (() => void)
) {
    if (destructor) destructor.call(this)
    cells.delete(this)
}

export type CellPropertyDecorator<V extends CellProperty<V>> = (
    (
        proto: Object,
        name: string | symbol,
        descr?: (TypedPropertyDescriptor<V> & {initializer?: () => V}) | void,
    ) => TypedPropertyDescriptor<V>
) | (
    (
        proto: Object,
        name: string | symbol
    ) => void
)

const objToString = Object.prototype.toString

function cellPropertyDecorator<V extends CellProperty<V>>(
    proto: Object,
    name: string | symbol,
    descr?: (TypedPropertyDescriptor<V> & {initializer?: () => V}) | void,
    destructor?: void | (() => void)
): TypedPropertyDescriptor<V> {
    const propName = String(name)
    const get: () => V = (descr && (descr.get || descr.initializer)) || valueGet
    const set: (next: V) => void = (descr && descr.set) || valueSet

    const getPropName = `${propName}#get`
    const setPropName = `${propName}#set`

    proto[getPropName] = get
    proto[setPropName] = set

    const cells: WeakMap<Object, Cell<V>> = new WeakMap()
    const cf = cellDecoratorState
    function value(next?: V): V {
        let cell: Cell<V> | void = cells.get(this)
        if (cell === undefined) {
            cell = new cf.FiberCell(
                this,
                getPropName,
                setPropName,
                undefined,
                cleanCell.bind(this, cells, destructor)
            )
            cells.set(this, cell)
        }

        /**
         * Used to extract cell from decorated value
         *
         * ```ts
         * const cell: Cell<Todos[]> = mem.cell(this.todos)
         * ```
         */
        if (cf.returnCell) {
            cf.returnCell = false
            return cell as any
        }

        return next === undefined ? cell.value() : cell.put(next)
    }

    return {
        enumerable: descr ? descr.enumerable : false,
        configurable: descr ? descr.configurable : true,
        get: value,
        set: value,
    }
}


/**
 * Public API cell facade
 */
export interface CellDecorator {
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
    <V extends CellProperty<V>>(
        proto: Object,
        name: string | symbol,
        descr: TypedPropertyDescriptor<V>
    ): TypedPropertyDescriptor<V>

    <V extends CellProperty<V>>(destructor: () => void): CellPropertyDecorator<V>

    (proto: Object, name: string | symbol): void

    /**
     * Check cell raw value. Used for restarting pending actions and for accessing cell status.
     *
     * @param v tracking property
     */
    state(v: any): Cell

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
     *     reload() { mem.reset(this.todos) }
     * }
     * ```
     */
    reset<V>(v: V): void
}

export const cellDecorator = ((...args: any[]) => {
    const destructorOrProto = args[0]
    const arg: string | void = args[1]
    if (arg) return cellPropertyDecorator(destructorOrProto, arg, args[2])

    return (
        proto: Object,
        name: string,
        descr
    ) => cellPropertyDecorator(proto, name, descr, destructorOrProto)
}) as CellDecorator

function callReset<V>(cell: Cell<V>): void {
    cell.reset()
}

function pass<V>(v: any): V {
    return v
}

Object.defineProperties(cellDecorator, {
    reset: {
        get() {
            cellDecoratorState.returnCell = true
            return callReset
        }
    },
    state: {
        get() {
            cellDecoratorState.returnCell = true
            return pass
        }
    }
})
