import * as React from 'react'
import {action, mem} from 'fibercell'
import {TodoRepository} from './models'
import {observer} from 'mobx-react'
import { sheet, Deps } from '../common'

class TodoToAdd {
    @mem title: string = ''

    constructor(
        protected _: {
            todoRepository: TodoRepository
        }
    ) {}

    get adding(): boolean {
        return !!this._.todoRepository.adding
    }

    @action.defer setRef(ref: HTMLInputElement | void) {
        if (ref) ref.focus()
    }

    @action onInput({target}: React.ChangeEvent<HTMLInputElement>) {
        this.title = target.value
    }

    @action onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.keyCode === 13 && this.title) {
            this._.todoRepository.add({title: this.title})
            this.title = ''
        }
    }
}

const css = sheet({
    newTodo: {
        position: 'relative',
        margin: '0',
        width: '100%',
        fontSize: '24px',
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        lineHeight: '1.4em',
        color: 'inherit',
        padding: '16px 16px 16px 60px',
        border: 'none',
        background: 'rgba(0, 0, 0, 0.003)',
        boxShadow: 'inset 0 -2px 1px rgba(0,0,0,0.03)',
        boxSizing: 'border-box',
    },
})

export interface TodoHeaderProps {
    id: string
    _: Deps<typeof TodoToAdd>
}

@observer
export class TodoHeader extends React.PureComponent<TodoHeaderProps> {
    protected todoToAdd = new TodoToAdd(this.props._)

    render() {
        const {
            todoToAdd,
            props: {id}
        } = this

        return <header id={id}>
            <input
                id={`${id}-input`}
                className={css.newTodo}
                placeholder="What needs to be done?"
                disabled={todoToAdd.adding}
                onInput={todoToAdd.onInput}
                ref={todoToAdd.setRef}
                value={todoToAdd.title}
                onKeyDown={todoToAdd.onKeyDown}
            />
        </header>
    }
}
