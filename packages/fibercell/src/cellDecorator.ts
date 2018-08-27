import {Cell} from './Cell'
import {setFunctionName, getId} from './utils'

export type CellProperty<V> = ((a: any, ...args: any[]) => any) extends V ? never : any

export const cellDecoratorState: {
    returnCell: boolean,
    FiberCell: typeof Cell
} = {
    returnCell: false,
    FiberCell: Cell,
}

export function setupCellClass(NewCell: typeof Cell) {
    cellDecoratorState.FiberCell = NewCell
}

function valueGet<V>(): any {}
function valueSet<V>(next?: V): any { return next }

export function cellDecorator<V extends CellProperty<V>>(
    proto: Object,
    name: string | symbol,
    descr?: (TypedPropertyDescriptor<V> & {initializer?: () => V}) | void
): TypedPropertyDescriptor<V> {
    const displayName = getId(proto, name)
    const get: () => V = (descr && (descr.get || descr.initializer)) || valueGet
    const set: (next: V) => void = (descr && descr.set) || valueSet

    function handler<V>(next?: V): V {
        return next === undefined ? get.call(this) : set.call(this, next)
    }
    setFunctionName(handler, `${displayName}$get_set`)

    const cells: WeakMap<Object, Cell<V>> = new WeakMap()
    const cf = cellDecoratorState
    function value(next?: V): V {
        let cell: Cell<V> | void = cells.get(this)
        if (cell === undefined) {
            cell = new cf.FiberCell(
                displayName,
                handler.bind(this),
                cells.delete.bind(cells, this)
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
        if (cf.returnCell) return cell as any

        return cell.value(next)
    }

    setFunctionName(value, `${displayName}()`)

    return {
        enumerable: descr ? descr.enumerable : false,
        configurable: descr ? descr.configurable : true,
        get: value,
        set: value,
    }
}

export type CellKeyProperty<K, V> = (key: K, next?: V) => V

function cleanMap<K, V>(key: K, cellMap: Map<K, V>, cells: WeakMap<Object, Map<K, V>>) {
    cellMap.delete(key)
    if (cellMap.size === 0) cells.delete(this)
}

export function cellKeyDecorator<K, V, Method extends CellKeyProperty<K, V>>(
    proto: Object,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>
): TypedPropertyDescriptor<Method> {
    const displayName = getId(proto, name)

    const cells: WeakMap<Object, Map<K, Cell<V>>> = new WeakMap()
    const cf = cellDecoratorState
    const handler: Method = descr.value

    function value(key: K, next?: V): V {
        let cellMap = cells.get(this)
        if (cellMap === undefined) {
            cellMap = new Map()
            cells.set(this, cellMap)
        }
        let cell = cellMap.get(key)

        if (cell === undefined) {
            cell = new cf.FiberCell(
                displayName,
                handler.bind(this, key),
                cleanMap.bind(this, key, cellMap, cells)
            )
            cellMap.set(this, cell)
        }

        if (cf.returnCell) return cellMap as any

        return cell.value(next)
    }

    setFunctionName(value, `${displayName}()`)

    return {
        enumerable: descr.enumerable,
        configurable: descr.configurable,
        value: value as Method,
    }
}
