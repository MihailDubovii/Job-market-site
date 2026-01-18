const JobListItem = {
    view: (vnode) => {
        const job = vnode.attrs.job;
        return m('div', { class: 'px-2 py-1 border-b border-base-300 hover:bg-base-200' }, [
            m('div', { class: 'flex items-start gap-2' }, [
                m('span', { class: 'text-xs opacity-60 mt-1' }, `${vnode.attrs.index}.`),
                m('div', { class: 'flex-1' }, [
                    m('a', { 
                        href: `#!/jobs/${job.id}`,
                        class: 'text-sm font-medium hover:underline text-base-content',
                        oncreate: m.route.link
                    }, job.title),
                    m('div', { class: 'flex flex-wrap gap-2 mt-1 text-xs opacity-70' }, [
                        job.company && m('span', { class: 'badge badge-outline badge-sm' }, job.company),
                        job.location && job.location.city && m('span', job.location.city),
                        job.salary && m('span', formatSalary(job.salary)),
                        job.posting_date && m('span', formatDate(job.posting_date))
                    ])
                ])
            ])
        ]);
    }
};

