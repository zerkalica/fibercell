# Fibercell

Observables (like mobx, cellx, mol_atom) with [fibers](https://gist.github.com/nin-jin/5408ef8f16f43f1b4fe9cbcea577aac6) fusion.
Solves [colored function](http://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) problem in browser.

Observable, computed, pullable, pushable, restartable.

```ts
import {FiberCell, mem} from 'fibercell'
import {MobxCellController} from 'fibercell-mobx'

FiberCell.CellController = MobxCellController

class TodoRepository {
  /**
   * Like mobx.observable
   */
  @mem counter = 0

  /**
   * Like mobx.computed
   */
  @mem get num(): number { return this.counter + 1 }

  /**
   * Pull text from server and cache it while this observable used.
   */
  @mem get text(): string { return fetchJson(...) }

  /**
   * Set new text value.
   */
  @mem set text(next: string) {}

  /**
   * ```ts
   * 
   * // Pull value from server
   * const text = repository.text2()
   *
   * // Set value
   * repository.text2('test')
   * ```
   */
  @mem text2(next?: string): string {
    if (next) return next
    return fetchJson(...)
  }
}
 ```

```tsx
import {fiberize, FiberCell, Fiber, mem} from 'fibercell'
import {MobxCellController} from 'fibercell-mobx'
import * as React from 'react'

FiberCell.CellController = MobxCellController

const fetchJson = fiberize(fetch, r => r.json())

interface Todo {
    id: string
    completed: boolean
    title: string
}

class TodoRepository {
    @mem get todos(): Todo[] {
        return fetchJson('/todos')
    }

    set todos(data: Todo[]) {}

    reload() { mem.reset(this.todos) }

    get inAction(): boolean {
        return mem.ok(this.completeAll)
            && mem.ok(this.add)
            && mem.ok(this.update)
            && mem.ok(this.remove)
    }

    @mem.action completeAll() {
        const incomplete: Todo[] = this.todos.filter(t => !t.completed)
        const patch = incomplete.map(todo => (
            [todo.id, {completed: true}] as [string, Partial<Todo>]
        ))

        fetchJson('/todos', {method: 'POST', body: JSON.stringify(patch)})

        const map = new Map(patch)
        this.todos = this.todos.map(t =>
            map.has(t.id)
                ? {...t, ...map.get(t.id)}
                : t
        )
    }

    @mem.action add(todo: Todo) {
        const newTodos = fetchJson('/todos', {method: 'PUT', body: JSON.stringify(todo)})
        this.todos = newTodos
    }

    @mem.action update(todo: Todo) {
        fetchJson(`/todo/${todo.id}`, {method: 'POST', body: JSON.stringify(todo)})
        this.todos = this.todos.map(t => t.id === todo.id ? todo : t)
    }

    @mem.action remove(todo: Todo) {
        fetchJson(`/todo/${todo.id}`, {method: 'DELETE'})
        this.todos = this.todos.filter(t => t.id !== todo.id)
    }
}

export function TodosView({rep}: {rep: TodoRepository}) {
    try {
        return <div>
            <button
                disabled={rep.inAction}
                onClick={() => rep.add({id: '123', title: '123', completed: false})}
            >Add</button>
            <ul>
                {rep.todos.map(todo =>
                    <li>
                        {todo.id} # {todo.title}
                        <button
                            disabled={rep.inAction}
                            onClick={() => rep.update({...todo, title: todo.title + '-upd'})}
                        >Update</button>
                        <button
                            disabled={rep.inAction}
                            onClick={() => rep.remove(todo)}
                        >Remove</button>
                    </li>
                )}
            </ul>
        </div>
    } catch (e) {
        const fiber = Fiber.from(e)
        if (e instanceof Error && !fiber) throw e

        return <div>
            {e instanceof Promise && <div>Loading...</div>}
            {e instanceof Error && <div>Error: {e.message}</div>}
            {fiber && e instanceof Error && <button onClick={() => fiber.reset()}>Retry</button>}
            {fiber && e instanceof Error && <button onClick={() => fiber.abort()}>Abort</button>}
        </div>
    }
}
```
