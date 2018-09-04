import {mem, action} from 'fibercell'
import {LocationStore} from './LocationStore'

export interface BasePage {
    id: string
    title: string
}

export class PageRepository<Page extends BasePage> {
    constructor(
        protected _: {
            locationStore: LocationStore
        },
        protected pages: Page[],
        protected key: string = 'page'
    ) {}

    @action setPageId(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault()
        const id = (e.target as any).dataset.id
        this.page = this.pages.find(page => page.id === id)
    }

    @action getPageUrl(page: string): string {
        return this._.locationStore.toUrl({page})
    }

    @mem get page(): Page {
        const pageId: string = this._.locationStore.value(this.key)
        if (!pageId) return this.pages[0]

        return this.pages.find(page => page.id === pageId)
    }

    set page(page: Page) {
        if (!page) throw new Error(
            `Provide data-id attribute for ${String(this)}.setPageId`
        )

        this._.locationStore.value(this.key, page.id)
    }
}
