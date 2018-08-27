import * as React from 'react'
import {TodoHeader} from './TodoHeader'
import {TodoMain} from './TodoMain'
import {TodoFooter} from './TodoFooter'
import {TodoRepository} from './models'
import {sheet, Deps, Omit} from '../common'
import {observer} from 'mobx-react'

const css = sheet({
    todoapp: {
        background: '#fff',
        position: 'relative',
        border: '1px solid #ededed',
        boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 25px 50px 0 rgba(0, 0, 0, 0.1)'
    }
})

export interface TodoAppProps {
    id: string
    _: Omit<
        Deps<typeof TodoHeader>
        & Deps<typeof TodoMain>
        & Deps<typeof TodoFooter>
        & Deps<typeof TodoRepository>
    , 'todoRepository'>
}

@observer
export class TodoApp extends React.PureComponent<TodoAppProps> {
    protected _ = {
        ...this.props._,
        todoRepository: new TodoRepository(this.props._)
    }

    render() {
        const {_, props: {id}} = this

        return <div id={id} className={css.todoapp}>
            <TodoHeader id={`${id}-header`} _={_} />
            <TodoMain id={`${id}-main`} _={_} />
            <TodoFooter id={`${id}-footer`} _={_} />
        </div>
    }
}
