import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
type Skill = { id: string; name: string; description: string; license: string; source: string; sourceType: "RooAGI" | "Community"; sourceUrl: string; path: string; body: string };
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function inlineMarkdown(text: string): ReactNode[] {
  const token = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  return text.split(token).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return /^https?:\/\//i.test(link[2]) ? <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a> : link[1];
    return part;
  });
}
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [], list: string[] = [], code: string[] | null = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push(<p key={blocks.length}>{inlineMarkdown(paragraph.join(" "))}</p>); paragraph = []; };
  const flushList = () => { if (list.length) blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{inlineMarkdown(item)}</li>)}</ul>); list = []; };
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      flushParagraph(); flushList();
      if (code) { blocks.push(<pre key={blocks.length}><code>{code.join("\n")}</code></pre>); code = null; } else code = [];
      continue;
    }
    if (code) { code.push(line); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/), item = line.match(/^\s*[-*+]\s+(.+)$/), quote = line.match(/^>\s?(.*)$/);
    if (heading) {
      flushParagraph(); flushList(); const level = heading[1].length;
      blocks.push(level === 1 ? <h2 key={blocks.length}>{inlineMarkdown(heading[2])}</h2> : level === 2 ? <h3 key={blocks.length}>{inlineMarkdown(heading[2])}</h3> : <h4 key={blocks.length}>{inlineMarkdown(heading[2])}</h4>);
    } else if (item) { flushParagraph(); list.push(item[1]); }
    else if (quote) { flushParagraph(); flushList(); blocks.push(<blockquote key={blocks.length}>{inlineMarkdown(quote[1])}</blockquote>); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  flushParagraph(); flushList();
  if (code) blocks.push(<pre key={blocks.length}><code>{code.join("\n")}</code></pre>);
  return <div className="markdown-body">{blocks}</div>;
}
function SkillMark() { return <span className="skill-mark" aria-hidden="true"><i /><i /><i /></span>; }
function App() {
  const [catalog, setCatalog] = useState<Skill[]>([]), [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => decodeURIComponent(location.hash.replace(/^#skill=/, "")));
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "catalog.json").then(response => { if (!response.ok) throw new Error("The built catalog could not be loaded."); return response.json(); })
      .then((items: Skill[]) => setCatalog(items)).catch(error => setLoadError(error instanceof Error ? error.message : "The built catalog could not be loaded."));
  }, []);
  useEffect(() => { const sync = () => setSelectedId(decodeURIComponent(location.hash.replace(/^#skill=/, ""))); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return catalog.filter(skill => { const haystack = normalize([skill.name, skill.description, skill.source, skill.body].join(" ")); return terms.every(term => haystack.includes(term)); });
  }, [catalog, query]);
  const results = matches;
  const selected = catalog.find(skill => skill.id === selectedId);
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); }
  function openSkill(id: string) { setSelectedId(id); location.hash = "skill=" + encodeURIComponent(id); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeSkill() { setSelectedId(""); history.pushState(null, "", location.pathname + location.search); }
  return <div className="page-shell">
    <header className="topbar"><a className="brand" href={import.meta.env.BASE_URL} aria-label="RooAGI Skills Atlas home"><span className="brand-symbol" aria-hidden="true">r</span><span>rooagi <span className="brand-light">/ skills</span></span></a><span className="topbar-note"><span className="live-dot" /> {catalog.length ? `${catalog.length} indexed instructions` : "Loading catalog"}</span></header>
    <main>
      {selected ? <section className="detail-view" aria-labelledby="detail-title"><button className="back-button" onClick={closeSkill}>← Back to results</button><p className="eyebrow">Skill details</p><h1 id="detail-title">{selected.name}</h1><p className="detail-description">{selected.description}</p><div className="detail-meta"><span>{selected.sourceType === "RooAGI" ? "RooAGI" : selected.source}</span><span>{selected.license}</span><span>{selected.path}</span><a href={selected.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></div><Markdown text={selected.body} /></section> : <>
        <section className="intro" aria-labelledby="page-title"><div className="intro-copy"><p className="eyebrow">A field guide for agent work</p><h1 id="page-title">Find the right skill<br /><span>for the work.</span></h1><p className="intro-description">Practical instructions for building, researching, and getting things done with RooAGI.</p></div><div className="index-note"><span className="index-note__glyph" aria-hidden="true">⌕</span><span>Search the full<br />curated library</span></div></section>
        <section className="search-section" aria-label="Search skills"><form className="search-form" onSubmit={submitSearch}><label className="sr-only" htmlFor="skill-search">Search skills</label><span className="search-icon" aria-hidden="true">⌕</span><input id="skill-search" type="search" placeholder="Try accessibility, AWS, or planning" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit">Search <kbd>↵</kbd></button></form><div className="search-hint"><span>Tip</span> Local search scans names, descriptions, sources, and full instructions as you type.</div></section>
        <section className="results-section" aria-labelledby="results-title"><div className="results-heading"><div><p className="eyebrow">Library search</p><h2 id="results-title">{query ? `Skills for “${query}”` : "All skills"}</h2></div><p className="result-count">{results.length} of {catalog.length} {results.length === 1 ? "skill" : "skills"}</p></div>
          {loadError ? <div className="state-panel state-panel--error" role="alert"><span className="state-symbol">!</span><div><h3>Catalog is unavailable</h3><p>{loadError}</p></div></div> : results.length ? <div className="result-list">{results.map(skill => <article className="skill-row" key={skill.id}><div className="skill-row__top"><div className="skill-name"><SkillMark /><h3>{skill.name}</h3></div><span className={"source-tag " + (skill.sourceType === "RooAGI" ? "source-tag--local" : "")}>{skill.sourceType === "RooAGI" ? "RooAGI" : skill.source}</span></div><p className="skill-description">{skill.description}</p><div className="skill-meta"><span>{skill.path}</span><span>{skill.license}</span><button type="button" className="text-button" onClick={() => openSkill(skill.id)}>Read skill</button></div></article>)}</div> : <div className="state-panel" role="status"><span className="state-symbol">⌕</span><div><h3>No skills found</h3><p>Try a broader phrase, a tool name, or a different part of the task.</p></div></div>}
        </section>
      </>}
    </main><footer className="footer"><span>Instructions that help agents do useful work.</span><span>RooAGI Skills Atlas</span></footer>
  </div>;
}
export { App };
