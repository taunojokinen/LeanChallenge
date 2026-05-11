import './sidebar.css'

function Sidebar({ sections }) {
  return (
    <aside className="sidebar">
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <div className="sidebar-list">
            {section.items.map((item) => (
              <button type="button" className="sidebar-item" key={item}>
                {item}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  )
}

export default Sidebar
