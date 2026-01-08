const AnalysisDetailPage = {
    view: () => m('div', { class: 'container mx-auto px-4 py-8' }, [
        m('div', { class: 'alert alert-info' }, [
            m('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'stroke-current shrink-0 w-6 h-6' }, [
                m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
            ]),
            m('div', [
                m('div', { class: 'font-bold' }, 'Analysis system updated'),
                m('div', { class: 'text-sm' }, 'Please use the custom analysis builder on the main Analysis page.')
            ])
        ]),
        m('a', {
            href: '#!/analysis',
            oncreate: m.route.link,
            class: 'btn btn-primary mt-4'
        }, 'Go to Analysis Builder')
    ])
};
