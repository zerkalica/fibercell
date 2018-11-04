export interface LoggerConsole {
    debug(message?: any, ...args: any[]): void
    error(message?: any, ...args: any[]): void
    log(message?: any, ...args: any[]): void
    warn(message?: any, ...args: any[]): void
}

function stringToColor(str: string): string {
    let hash = 0
    for(let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 3) - hash)
    }
    const color = Math.abs(hash).toString(16).substring(0, 6)

    return 'font-weight: bold; color: #' + '000000'.substring(0, 6 - color.length) + color + ';'
}

export class Logger {
    constructor(
        public filter?: RegExp | void,
        public useColors: boolean = true,
        public output: LoggerConsole = console
    ) {}

    static current: Logger = new Logger()

    protected message(name: string, method: keyof LoggerConsole, ...args: any[]) {
        if (this.filter && !this.filter.test(name)) return
        const {useColors} = this
        this.output[method].call(
            this.output,
            useColors ? '%c' + name : name,
            useColors ? stringToColor(name) : '',
            ...args
        )
    }

    /**
     * @throws Promise or Error
     */
    actionError(target: string, error: Error) {
        this.message(target, 'error', 'action', error)
    }

    /**
     * @throws Promise or Error
     */
    rollbackError(target: string, error: Error) {
        this.message(target, 'error', 'rollback', error)
    }

    /**
     * @throws Promise or Error
     */
    free(target: Object) {
        if (!this.filter) return
        this.message(String(target), 'debug', 'free')
    }

    /**
     * @throws Promise or Error
     */
    rendered(target: Object) {
        if (!this.filter) return
        this.message(String(target), 'debug', 'rendered')
    }

    /**
     * @throws Promise or Error
     */
    destructError(target: Object, actual: any, error: Error) {
        if (!this.filter) return
        this.message(String(target), 'warn', 'destruct', actual, error)
    }

    /**
     * @throws Promise or Error
     */
    changed<V>(target: Object, from: Promise<V> | Error | V, to: Promise<V> | Error | V) {
        if (!this.filter) return
        const name = String(target)
        if (!this.filter.test(name)) return

        let method: keyof LoggerConsole = 'log'
        let fromValue: any = from
        let toValue: any = to
        if (from instanceof Error) method = 'warn'
        if (to instanceof Error) method = 'error'

        this.message(
            name,
            method,
            fromValue,
            '➔',
            toValue
        )
    }
}

export function setupLogger(logger: Logger) {
    Logger.current = logger
}
