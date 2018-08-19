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

function createInitializer<V>(initializer: (() => V) | void, name: string): () => V {
    const get = function() {
        return initializer ? initializer.call(this) : undefined
    }
    setFunctionName(get, `${name}#get`)
    return get
}

function createSetter<V>(name: string): (next?: V) => V {
    const set = function(next?: V): any { return next }
    setFunctionName(set, `${name}#set`)
    return set
}

export function cellDecorator<V extends CellProperty<V>>(
    proto: Object,
    name: string,
    descr: TypedPropertyDescriptor<V>
): TypedPropertyDescriptor<V> {
    const handlerKey = `${name}$`
    if (proto[handlerKey] !== undefined) return descr
    const displayName = getId(proto, name)
    const get: () => V = descr.get || createInitializer((descr as any).initializer, name)
    const set: (next: V) => void = descr.set || createSetter(name)

    const cells: WeakMap<Object, Cell<V>> = new WeakMap()
    const cf = cellDecoratorState
    function value(next?: V): V {
        let cell: Cell<V> | void = cells.get(this)
        if (cell === undefined) {
            cell = new cf.FiberCell(
                displayName,
                get,
                set,
                this,
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
        enumerable: descr.enumerable,
        configurable: descr.configurable,
        get: value,
        set: value,
    }
}
