import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { albumCollections } from './linuxAlbumData';
import './AlbumPage.css';

export default function AlbumPage() {
  const [collectionId, setCollectionId] = useState('all');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCollections = useMemo(() => albumCollections
    .filter((collection) => collectionId === 'all' || collection.id === collectionId)
    .map((collection) => ({
      ...collection,
      topics: collection.topics.filter((topic) => !normalizedQuery || [
        topic.title, topic.summary, topic.sourcePages, ...topic.details,
        ...topic.keywords, ...topic.examples.flatMap((example) => [example.command, example.note]),
      ].join(' ').toLowerCase().includes(normalizedQuery)),
    })).filter((collection) => collection.topics.length), [collectionId, normalizedQuery]);
  return <main className="album-page page-shell">
    <section className="album-tools" aria-label="Filter reference topics">
      <label className="album-search"><Icon name="search" size={18}/><span className="sr-only">Search topics</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands or topics"/></label>
      <label className="album-collection-select"><span>Collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)} aria-label="Filter by collection"><option value="all">All topics</option>{albumCollections.map((collection) => <option value={collection.id} key={collection.id}>{collection.title}</option>)}</select></label>
    </section>

    <aside className="album-note"><Icon name="terminal" size={17}/><p>These notes describe general Linux tools. LinuxLab’s practice shell supports a limited simulated command set; administrative and disk examples here do not run on your computer.</p></aside>

    {visibleCollections.length ? <div className="album-collections">
      {visibleCollections.map((collection) => <section className="album-collection" key={collection.id}>
        <div className="album-collection-heading"><span className="album-collection-number">{collection.number}</span><div><h2>{collection.title}</h2><p>{collection.description}</p></div><span className="album-collection-count">{collection.topics.length} topics</span></div>
        <div className="album-topic-list">
          {collection.topics.map((topic, index) => <details className="album-topic" key={topic.title} style={{ '--topic-index': index }}>
            <summary><span className="album-topic-marker"><Icon name="terminal" size={15}/></span><span className="album-topic-copy"><strong>{topic.title}</strong><small>{topic.summary}</small></span><span className="album-topic-toggle" aria-hidden="true">+</span></summary>
            <div className="album-topic-details">
              <ul>{topic.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              {topic.examples.length > 0 && <div className="album-examples"><h3>Examples</h3>{topic.examples.map((example) => <div className="album-example" key={`${example.command}-${example.note}`}><code>{example.command}</code><span>{example.note}</span></div>)}</div>}
              <p className="album-source">Source: {collection.source}, {topic.sourcePages}</p>
            </div>
          </details>)}
        </div>
      </section>)}
    </div> : <div className="album-empty"><strong>No matching topics</strong><span>Try another search or collection.</span></div>}
  </main>;
}
