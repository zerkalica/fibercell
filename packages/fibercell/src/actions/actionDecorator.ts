import {Queue} from './Queue'
import {setFunctionName} from '../utils'

type Class<Target> = Object

type ActionMethod = (...args: any[]) => void

export type ActionMethodDecorator<Target, Method extends ActionMethod> = (
    target: Class<Target>,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
    selector?: ((object: Target) => Queue) | void
) => TypedPropertyDescriptor<Method>

function actionMethodDecorator<Target, Method extends ActionMethod>(
    proto: Class<Target>,
    name: string,
    descr: TypedPropertyDescriptor<Method>,
    selector?: ((object: Target) => Queue) | void
): TypedPropertyDescriptor<Method> {
    const handler: Method = descr.value
    const actionIds = Queue.actionIds
    function action(id: Function, args: any[]): void {
        actionIds.push(id)
        try {
            if (selector) {
                const binded = handler.bind(this, ...args)
                setFunctionName(binded, name)
                const queue = selector(this)
                queue.run(binded)
            } else {
                handler.apply(this, args)
            }
        } finally {
            actionIds.pop()
        }
    }

    let defining = false
    function get(): Method {
        const value = ((...args: any[]) => action.call(this, value, args)) as Method
        setFunctionName(value, name)
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
        descr: TypedPropertyDescriptor<Method>
    ): TypedPropertyDescriptor<Method>
    <Target, Method extends ActionMethod>(
        selector?: ((t: Target) => Queue) | void
    ): ActionMethodDecorator<Target, Method>
    defer: Action
}

export const action = (<Target, Method extends ActionMethod>(...args: any[]) => {
    const selectorOrProto = args[0]
    const arg: string | void = args[1]
    if (arg) return actionMethodDecorator(selectorOrProto, arg, args[2])

    return (
        proto: Object,
        name: string,
        descr: TypedPropertyDescriptor<Method>
    ) => actionMethodDecorator(proto, name, descr, selectorOrProto)
}) as Action
