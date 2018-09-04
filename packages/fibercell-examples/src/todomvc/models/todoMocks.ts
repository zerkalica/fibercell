import {uuid, ModelStorage} from '../../common'
import {ITodo, ITodoInfo} from './Todo'

function getBody(body: (string | Object) | void): any {
    return typeof body === 'string'
        ? JSON.parse(body)
        : ((body || {}) as any)
}

function sortByDate(el1: ITodo, el2: ITodo): number {
    if (!el2.created || el1.created) {
        return 0
    }

    if (String(el1.created) > String(el2.created)) {
        return 1
    }
    if (String(el1.created) < String(el2.created)) {
        return -1
    }
    return 0
}

export function todoMocks(rawStorage: Storage) {
    const defaultTodos: ITodo[] = [
        {
            id: uuid(),
            title: 'test todo #1',
            completed: false,
            created: new Date()
        },
        {
            id: uuid(),
            title: 'test todo #2',
            completed: true,
            created: new Date()
        }
    ]
    const todoStorage = new ModelStorage(rawStorage, 'TodoMocks.todos', defaultTodos)
    const infoStorage = new ModelStorage(rawStorage, 'TodoMocks.infoStorage', [] as ITodoInfo[])

    return [
        {
            method: 'GET',
            matcher: new RegExp('/api/todos'),
            response(url: string, params: RequestInit) {
                return todoStorage.get().sort(sortByDate)
            }
        },
        {
            method: 'GET',
            matcher: new RegExp('/api/todo/(.*)/info'),
            response(url: string, params: RequestInit, id: string) {
                const data = infoStorage.get()
                const i = data.find((inf) => inf.id === id)
                return {id, description: i ? i.description : 'desc'} as ITodoInfo
            }
        },
        {
            method: 'PUT',
            matcher: new RegExp('/api/todos'),
            response(url: string, params: RequestInit) {
                const todos: void | ITodo[] = todoStorage.get()
                const updates: Map<string, Partial<ITodo>> = new Map(getBody(params.body))

                const newTodos = todos
                    .map(todo => {
                        return {...todo, ...updates.get(todo.id)} as ITodo
                    })
                    .sort(sortByDate)
                todoStorage.set(newTodos)

                return newTodos
            }
        },
        {
            method: 'DELETE',
            matcher: new RegExp('/api/todos'),
            response(url: string, params: RequestInit) {
                const todos: ITodo[] = todoStorage.get()
                const ids: string[] = getBody(params.body)
                const newTodos = todos.filter(todo =>
                    ids.indexOf(todo.id) === -1
                )
                todoStorage.set(newTodos)

                return newTodos.map(({id}) => id)
            }
        },
        {
            method: 'DELETE',
            matcher: new RegExp('/api/todo/(.*)'),
            response(url: string, params: RequestInit, id: string) {
                const todos: ITodo[] = todoStorage.get()
                const newTodos = todos.filter(todo => todo.id !== id)
                todoStorage.set(newTodos.sort(sortByDate))

                return {id}
            }
        },
        {
            method: 'POST',
            matcher: new RegExp('/api/todo/(.*)'),
            response(url: string, params: RequestInit, id: string) {
                const data: ITodo[] = todoStorage.get()
                const newTodo = getBody(params.body)
                const newTodos = (data || []).map(todo => (todo.id === id ? newTodo : todo))
                todoStorage.set(newTodos)

                return newTodo
            }
        },
        {
            method: 'PUT',
            matcher: new RegExp('/api/todo'),
            response(url: string, params: RequestInit) {
                const todos: ITodo[] = todoStorage.get() || []
                const body = getBody(params.body)
                const id = uuid()

                const newTodo: ITodo = {
                    ...body,
                    id
                }
                todos.push(newTodo)
                todoStorage.set(todos)
                infoStorage.set([
                    ...infoStorage.get(),
                    {
                        id,
                        description: 'desc#' + id
                    }
                ])
                return newTodo
            }
        }
    ]
}
