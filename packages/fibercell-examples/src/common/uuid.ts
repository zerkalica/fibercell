export function uuid(): string {
    return `${Math.random()}.${Date.now()}.tmp`.substring(2)
}
