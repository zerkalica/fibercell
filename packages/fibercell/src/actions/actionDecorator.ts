import {Queue} from './Queue'
import {setFunctionName, defer, Logger} from '../utils'
import {Cell} from '../Cell'

type Class<Target> = Object

type ActionMethod = (...args: any[]) => any

export type ActionMethodDecorator<Target, Method extends ActionMethod> = (
    target: Class<Target>,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
) => TypedPropertyDescriptor<Method>

const objToString = Object.prototype.toString

function actionDecorator<Target, Method extends ActionMethod>(
    proto: Class<Target>,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>,
    isDefer?: boolean
): TypedPropertyDescriptor<Method> {
    const handler: Method = descr.value
    const actionIds = Queue.actionIds
    const propName = String(name)
    const staticName = `${proto.constructor.name}.${propName}`

    function action(id: Function, args: any[], cell: Cell<any> | void): void {
        actionIds.push(id)
        let result
        try {
            result = handler.apply(this, args)
        } catch (error) {
            if (cell) {
                cell.setError(error)
            } else {
                Logger.current.actionError(id.name, error)
            }
        }
        actionIds.pop()

        return result
    }

    let defining = false
    function get(): Method {
        const value = ((...args: any[]) =>
            isDefer
                ? defer.then(action.bind(this, value, args, Cell.current))
                : action.call(this, value, args, Cell.current)
        ) as Method

        setFunctionName(value, this.toString === objToString ? staticName : `${String(this)}.${propName}`)
        if (defining) return value
        defining = true
        Object.defineProperty(this, name, {
            configurable: false,
            enumerable: false,
            value,
        })
        defining = false

        return value
    }

    return {
        enumerable: descr.enumerable,
        configurable: true,
        get,
    }
}

export interface Action {
    <Target, Method extends ActionMethod>(
        proto: Class<Target>,
        name: string,
        descr: TypedPropertyDescriptor<Method>,
        defer?: boolean
    ): TypedPropertyDescriptor<Method>
    defer: typeof actionDecorator
}

export const action = actionDecorator as Action

action.defer = (proto, name, descr) => actionDecorator(proto, name, descr, true)
