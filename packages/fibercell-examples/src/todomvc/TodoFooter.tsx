// @flow
import {mem, action} from 'fibercell'
import * as React from 'react'
import {TodoRepository, TODO_FILTER} from './models'
import {observer} from 'mobx-react'
import {Deps, sheet, LocationStore} from '../common'

class TodoFooterService {
    links = [
        {
            id: TODO_FILTER.ALL,
            title: 'All'
        },
        {
            id: TODO_FILTER.ACTIVE,
            title: 'Active'
        },
        {
            id: TODO_FILTER.COMPLETE,
            title: 'Completed'
        }
    ]

    constructor(
        protected _: {
            todoRepository: TodoRepository
        }
    ) {}

    @action clickLink(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault()
        const linkid = (e.target as any).dataset.linkid
        if (!linkid) return
        this._.todoRepository.filter = linkid as TODO_FILTER
    }

    @mem get css() {
        const linkBase = {
            color: 'inherit',
            margin: '3px',
            padding: '3px 7px',
            textDecoration: 'none',
            border: '1px solid transparent',
            borderRadius: '3px',
            $nest: {
                '& :hover': {
                    borderColor: 'rgba(175, 47, 47, 0.1)'
                }
            }
        }

        return sheet({
            footer: {
                color: '#777',
                padding: '10px 15px',
                height: '20px',
                textAlign: 'center',
                borderTop: '1px solid #e6e6e6',
                $nest: {
                    '&:before': {
                        content: '\'\'',
                        position: 'absolute',
                        right: '0',
                        bottom: '0',
                        left: '0',
                        height: '50px',
                        overflow: 'hidden',
                        boxShadow: `0 1px 1px rgba(0, 0, 0, 0.2),
                            0 8px 0 -3px #f6f6f6,
                            0 9px 1px -3px rgba(0, 0, 0, 0.2),
                            0 16px 0 -6px #f6f6f6,
                            0 17px 2px -6px rgba(0, 0, 0, 0.2)`
                    }
                }
            },

            todoCount: {
                float: 'left',
                textAlign: 'left'
            },

            filters: {
                margin: 0,
                padding: 0,
                listStyle: 'none',
                position: 'absolute',
                right: 0,
                left: 0
            },

            filterItem: {
                display: 'inline'
            },

            linkRegular: linkBase,

            linkSelected: {
                ...linkBase,
                borderColor: 'rgba(175, 47, 47, 0.2)'
            },

            clearCompleted: {
                margin: 0,
                padding: 0,
                border: 0,
                background: 'none',
                fontSize: '100%',
                verticalAlign: 'baseline',
                float: 'right',
                position: 'relative',
                lineHeight: '20px',
                textDecoration: 'none',
                cursor: 'pointer',
                $nest: {
                    ':hover': {
                        textDecoration: 'underline'
                    }
                }
            }
        })
    }

    link(isSelected: boolean) {
        return isSelected ? this.css.linkSelected : this.css.linkRegular
    }
}

export interface TodoFooterProps {
    id: string
    _: Deps<typeof TodoFooterService> & {
        locationStore: LocationStore
        todoRepository: TodoRepository
    }
}

@observer
export class TodoFooter extends React.PureComponent<TodoFooterProps> {
    protected todoFooterService = new TodoFooterService(this.props._)

    render() {
        const {
            props: {
                id,
                _: {
                    locationStore,
                    todoRepository: {completedCount, activeTodoCount, filter, clearing, clearCompleted},    
                }
            },
            todoFooterService
        } = this

        const {links, clickLink, css} = todoFooterService
        if (activeTodoCount === 0 && completedCount === 0) return null
    
        return <footer id={id} className={css.footer}>
            <span className={css.todoCount} id={`${id}-count`}>
                <strong id={`${id}-number`}>{activeTodoCount}</strong> item(s) left
            </span>
            <ul className={css.filters} id={`${id}-filters`}>
                {links.map(link => <li
                        key={link.id}
                        className={css.filterItem}
                        id={`${id}-link(${link.id})-item`}
                    ><a
                        id={`${id}-link(${link.id})-href`}
                        className={todoFooterService.link(filter === link.id)}
                        href={locationStore.toUrl({todo_filter: link.id})}
                        data-linkid={link.id}
                        onClick={clickLink}
                    >{link.title}</a>
                </li>)}
            </ul>
            {completedCount !== 0 && <button
                id={`${id}-clear`}
                className={css.clearCompleted}
                disabled={clearing}
                onClick={clearCompleted}>
                Clear completed
            </button>}
        </footer>
    }
}
