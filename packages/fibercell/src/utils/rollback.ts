import {unproxifyError} from './proxify'
import { Logger } from './Logger'

const rollbackKey = Symbol('rollback')

/**
 * @throws Error | Promise<any>
 */
export function rollback(rawData: any, cb?: (() => void)): void {
    if (!rawData) return
    const data = unproxifyError(rawData)
    if (cb) {
        if (data instanceof Error) {
            const prev = data[rollbackKey]
            data[rollbackKey] = prev
                ? () => {
                    prev()
                    cb()
                }
                : cb
        }

        throw rawData
    }
    if (!data || typeof data !== 'object' || !data[rollbackKey]) return
    try {
        data[rollbackKey]()
    } catch (error) {
        Logger.current.rollbackError(rawData, error)
    }
}
