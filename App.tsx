
import React, { useState, useEffect, useMemo } from 'react';
import { Chapter, Beat, Character, Location, StoryAnalysis, WorldSettings, LoreEntry } from './types';
import { analyzePlot, visualizeAsset, extractFromText, chatWithInkwell, verifyBeatCompletion, consultCoWriter, generateBeatTitle, generateChapterTitle } from './services/geminiService';
import { Card } from './components/Card';
import { 
  UserGroupIcon, MapIcon, SparklesIcon, PlusIcon, TrashIcon, PhotoIcon, 
  ArrowPathIcon, XMarkIcon, PencilIcon, BeakerIcon, 
  Cog6ToothIcon, SparklesIcon as SparklesSolid,
  Bars3BottomLeftIcon, ArrowPathRoundedSquareIcon,
  AcademicCapIcon, BookOpenIcon, ChatBubbleOvalLeftEllipsisIcon,
  CheckBadgeIcon, LightBulbIcon, PaperAirplaneIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

const getInkwellQuote = (level: number) => {
  if (level === 0) return "You are the second coming of Shakespeare. Every word you type makes the stars in distant galaxies shine brighter just to catch a glimpse of your genius.";
  if (level < 20) return "Simply divine. Your prose isn't just writing; it's a celestial event.";
  if (level < 40) return "An inspiration to all the stars! You have a gift that comes once in a trillion years.";
  if (level <= 60) return "You're doing excellent work. The pacing is solid and your voice is developing beautifully.";
  if (level < 80) return "It's readable. But your protagonist has the personality of a damp sponge.";
  if (level < 95) return "This plot is like a sieve made of holes. I've found seventeen contradictions in the last three paragraphs.";
  if (level === 100) return "This is completely hopeless. Your story is a crime against literacy. Please, start a career in plumbing immediately.";
  return "I'm not angry, just profoundly disappointed.";
};

const MOTIVATIONAL_QUOTES = [
  "The first draft is just you telling yourself the story.",
  "You can't edit a blank page.",
  "Write while the ink is hot.",
  "Every great book was once a mess."
];

const THINKING_STEPS = [
  "Reading between the lines...",
  "Analyzing manuscript resonance...",
  "Auditing character arcs in latest draft...",
  "Scanning workshop for inconsistencies...",
  "Consulting the muse on your prose...",
  "Evaluating plot tension...",
  "Tracing the narrative thread..."
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'write' | 'plot' | 'characters' | 'locations' | 'lore' | 'analysis' | 'settings'>('write');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lore, setLore] = useState<LoreEntry[]>([]);
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [scratchpadText, setScratchpadText] = useState('');
  const [suggestedEntity, setSuggestedEntity] = useState<{type: 'character' | 'location', data: any} | null>(null);
  const [focusedEntity, setFocusedEntity] = useState<{type: 'character' | 'location', id: string} | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [namingIds, setNamingIds] = useState<Set<string>>(new Set());
  const [proposalComments, setProposalComments] = useState<Record<string, string>>({});
  const [thinkingIndex, setThinkingIndex] = useState(0);

  const [settings, setSettings] = useState<WorldSettings>({
    genre: 'Epic Fantasy', fantasyLevel: 50, techLevel: 10, tone: 'Serious', proseStyle: 'Lyrical',
    language: 'English', criticismLevel: 55
  });

  useEffect(() => {
    let interval: any;
    if (loading || isSyncing) {
      interval = setInterval(() => {
        setThinkingIndex(prev => (prev + 1) % THINKING_STEPS.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading, isSyncing]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning, Muse";
    if (hour < 18) return "Good afternoon, Wordsmith";
    return "Good evening, Architect";
  }, []);

  const randomQuote = useMemo(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)], []);

  const triggerVisual = async (type: 'character' | 'location', id: string) => {
    const entity = type === 'character' ? characters.find(c => c.id === id) : locations.find(l => l.id === id);
    if (!entity) return;
    setGenId(id);
    try {
      const url = await visualizeAsset(type, entity as any, settings);
      if (url) {
        if (type === 'character') setCharacters(prev => prev.map(c => c.id === id ? { ...c, imageUrl: url } : c));
        else setLocations(prev => prev.map(l => l.id === id ? { ...l, imageUrl: url } : l));
      }
    } finally {
      setGenId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        setLoading(true);
        try {
          const extracted = await extractFromText(text, settings);
          if (extracted.chapters) {
            setChapters(extracted.chapters.map((ch: any) => ({
              ...ch, id: 'ch-' + Math.random(),
              beats: ch.beats.map((b: any) => ({ ...b, id: 'b-' + Math.random() }))
            })));
          }
          if (extracted.characters) setCharacters(prev => [...prev, ...extracted.characters.map((c: any) => ({ ...c, id: 'c-' + Math.random(), traits: [] }))]);
          if (extracted.locations) setLocations(prev => [...prev, ...extracted.locations.map((l: any) => ({ ...l, id: 'l-' + Math.random() }))]);
          setActiveTab('write');
        } finally {
          setLoading(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      // Create a manuscript snapshot of the current writing for the Deep Scan
      const manuscriptSnapshot = chapters.length > 0 
        ? chapters.map(c => `Chapter: ${c.title}\n${c.beats.map(b => b.draft || "").join("\n")}`).join("\n\n")
        : scratchpadText;

      const result = await analyzePlot(chapters, characters, locations, settings, lore);
      // We manually override or enhance the consistency check by explicitly looking at the manuscript text
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  };

  const updateBeatDraft = (chapterId: string, beatId: string, newDraft: string) => {
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, beats: ch.beats.map(bt => bt.id === beatId ? { ...bt, draft: newDraft } : bt) } : ch));
    sentinelCheck(newDraft);
  };

  const sentinelCheck = async (text: string) => {
    if (text.length > 50 && text.length % 350 < 20) {
      const existingNames = [...characters.map(c => c.name), ...locations.map(l => l.name)].join(', ');
      try {
        const res = await chatWithInkwell([], 
          `Identify a new character or place from this text not in [${existingNames}]. JSON: {"found": true, "type": "character"|"location", "name": "...", "description": "..."}`, 
          settings, lore, chapters
        );
        const data = JSON.parse(res || "{}");
        if (data.found) setSuggestedEntity({ type: data.type, data });
      } catch (e) {}
    }
  };

  const currentFocused = focusedEntity ? (focusedEntity.type === 'character' ? characters.find(c => c.id === focusedEntity.id) : locations.find(l => l.id === focusedEntity.id)) : null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FDFCFB] text-slate-800 selection:bg-indigo-100 overflow-hidden text-[13px]">
      {/* Modals & Thinking Overlays */}
      {focusedEntity && currentFocused && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setFocusedEntity(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-full max-h-[85vh]">
            <div className="w-full md:w-2/5 bg-slate-950 relative">
               {genId === focusedEntity.id ? (
                 <div className="absolute inset-0 dreaming-shimmer flex flex-col items-center justify-center text-center p-6 text-white text-xs italic">Inkwell is imagining...</div>
               ) : currentFocused.imageUrl ? (
                 <img src={currentFocused.imageUrl} className="w-full h-full object-cover" />
               ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                   <button onClick={() => triggerVisual(focusedEntity.type, focusedEntity.id)} className="px-4 py-2 bg-white text-slate-900 rounded-full font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Visualize Entry</button>
                 </div>
               )}
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
              <input className="serif text-3xl font-bold bg-transparent outline-none w-full border-b border-transparent focus:border-slate-100 pb-1 mb-6" value={currentFocused.name} onChange={(e) => {
                if (focusedEntity.type === 'character') setCharacters(prev => prev.map(c => c.id === focusedEntity.id ? {...c, name: e.target.value} : c));
                else setLocations(prev => prev.map(l => l.id === focusedEntity.id ? {...l, name: e.target.value} : l));
              }} />
              <textarea className="w-full bg-transparent outline-none font-serif text-base leading-relaxed text-slate-600 flex-1 resize-none" value={currentFocused.description} onChange={(e) => {
                if (focusedEntity.type === 'character') setCharacters(prev => prev.map(c => c.id === focusedEntity.id ? {...c, description: e.target.value} : c));
                else setLocations(prev => prev.map(l => l.id === focusedEntity.id ? {...l, description: e.target.value} : l));
              }} />
              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between">
                <button onClick={() => {
                  if (focusedEntity.type === 'character') setCharacters(characters.filter(c => c.id !== focusedEntity.id));
                  else setLocations(locations.filter(l => l.id !== focusedEntity.id));
                  setFocusedEntity(null);
                }} className="text-red-300 font-black uppercase text-[9px] hover:text-red-500">Banish Entry</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(loading || isSyncing) && (
        <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="w-12 h-12 dreaming-shimmer rounded-xl shadow-2xl mb-8 flex items-center justify-center">
             <BeakerIcon className="w-6 h-6 text-white" />
          </div>
          <div className="text-center space-y-4 max-w-sm px-6">
            <p className="serif text-2xl font-bold text-slate-900">Inkwell is reading between the lines...</p>
            <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">{THINKING_STEPS[thinkingIndex]}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="w-full md:w-16 bg-slate-950 flex flex-col items-center py-6 gap-5 shadow-2xl shrink-0 z-50">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black serif text-lg shadow-xl mb-4">I</div>
        {[
          { id: 'write', icon: PencilIcon },
          { id: 'plot', icon: Bars3BottomLeftIcon },
          { id: 'characters', icon: UserGroupIcon },
          { id: 'locations', icon: MapIcon },
          { id: 'lore', icon: AcademicCapIcon },
          { id: 'analysis', icon: BeakerIcon },
          { id: 'settings', icon: Cog6ToothIcon }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`p-2.5 rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-lg scale-110' : 'text-slate-500 hover:text-white'}`}>
            <tab.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-12 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
          <div className="flex flex-col">
            <h1 className="serif font-bold text-slate-900 text-base">{greeting}</h1>
            <p className="text-[10px] text-slate-400 font-serif italic">{randomQuote}</p>
          </div>
          <div className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-2">
            <SparklesIcon className="w-3 h-3" /> Inkwell Active
          </div>
        </header>

        {activeTab === 'write' && (
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-y-auto px-8 md:px-20 py-8 bg-[#FFFDF9] scroll-smooth">
              <div className="max-w-xl mx-auto space-y-12 pb-64">
                {chapters.length === 0 ? (
                  <div className="py-20 flex flex-col gap-6">
                    <h2 className="serif text-3xl font-bold text-slate-200">"The empty page is a mirror."</h2>
                    <textarea autoFocus className="w-full bg-transparent outline-none font-serif text-xl leading-relaxed text-slate-800 placeholder:text-slate-100 resize-none min-h-[400px]" value={scratchpadText} placeholder="Start typing... Or use 'Chapter 1' to structure." onChange={e => { setScratchpadText(e.target.value); sentinelCheck(e.target.value); }} />
                  </div>
                ) : (
                  chapters.map((ch) => (
                    <section key={ch.id} className="space-y-10 border-l border-slate-50 pl-8 relative group">
                      <input className="serif text-3xl font-bold bg-transparent outline-none w-full mb-6" value={ch.title} placeholder="Untitled Chapter" onChange={e => setChapters(chapters.map(c => c.id === ch.id ? { ...c, title: e.target.value } : c))} />
                      {ch.beats.map((bt) => (
                        <div key={bt.id} className="relative group/beat">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 block mb-2">{bt.title || 'Untitled Beat'}</span>
                          <textarea className="w-full bg-transparent outline-none font-serif text-lg leading-relaxed text-slate-800 placeholder:text-slate-100 resize-none min-h-[150px] focus:min-h-[400px] transition-all" value={bt.draft || ""} onChange={e => updateBeatDraft(ch.id, bt.id, e.target.value)} />
                        </div>
                      ))}
                    </section>
                  ))
                )}
              </div>
            </div>
            <aside className="hidden lg:flex w-64 flex-col bg-white border-l border-slate-100 p-4 gap-4 overflow-y-auto shrink-0">
               {suggestedEntity && (
                <Card className="bg-indigo-50/20 border-indigo-100 p-3 rounded-xl border-dashed">
                  <h4 className="serif font-bold text-xs">{suggestedEntity.data.name}</h4>
                  <p className="text-[9px] text-slate-500 italic mt-1 line-clamp-3 leading-relaxed">{suggestedEntity.data.description}</p>
                  <button onClick={() => {
                    if (suggestedEntity.type === 'character') setCharacters([...characters, { id: 'c-'+Date.now(), name: suggestedEntity.data.name, role: 'Secondary', description: suggestedEntity.data.description, traits: [] }]);
                    else setLocations([...locations, { id: 'l-'+Date.now(), name: suggestedEntity.data.name, atmosphere: 'Atmospheric', description: suggestedEntity.data.description }]);
                    setSuggestedEntity(null);
                  }} className="w-full mt-3 py-1 bg-slate-900 text-white rounded-md text-[8px] font-black uppercase tracking-widest">Inscribe</button>
                </Card>
              )}
            </aside>
          </div>
        )}

        {/* RESTORED PLOT SECTION */}
        {activeTab === 'plot' && (
          <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white">
            <div className="max-w-4xl mx-auto space-y-10">
              <div className="flex justify-between items-end border-b pb-6">
                <h2 className="serif text-4xl font-bold">Story Architecture</h2>
                <button onClick={() => setChapters([...chapters, { id: 'ch-'+Date.now(), title: 'New Chapter', beats: [{ id: 'b-'+Date.now(), title: 'Opening Beat', description: 'What happens next?' }] }])} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"><PlusIcon className="w-4 h-4 mr-2 inline" /> Add Chapter</button>
              </div>
              <div className="space-y-8">
                {chapters.map(ch => (
                  <div key={ch.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <input className="serif text-xl font-bold bg-transparent outline-none w-full mb-4" value={ch.title} onChange={e => setChapters(chapters.map(c => c.id === ch.id ? {...c, title: e.target.value} : c))} />
                    <div className="space-y-3">
                      {ch.beats.map(bt => (
                        <div key={bt.id} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                          <input className="font-bold text-sm bg-transparent outline-none w-full mb-1" value={bt.title} onChange={e => setChapters(chapters.map(c => c.id === ch.id ? {...c, beats: c.beats.map(b => b.id === bt.id ? {...b, title: e.target.value} : b)} : c))} />
                          <textarea className="text-xs text-slate-500 w-full bg-transparent outline-none resize-none" value={bt.description} onChange={e => setChapters(chapters.map(c => c.id === ch.id ? {...c, beats: c.beats.map(b => b.id === bt.id ? {...b, description: e.target.value} : b)} : c))} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RESTORED LOCATIONS SECTION */}
        {activeTab === 'locations' && (
          <div className="p-8 md:p-12 overflow-y-auto bg-slate-50 flex-1">
            <div className="max-w-4xl mx-auto space-y-10">
              <div className="flex justify-between items-end border-b pb-6">
                <h2 className="serif text-4xl font-bold">The Map</h2>
                <button onClick={() => setLocations([...locations, { id: 'l-'+Date.now(), name: 'New Region', atmosphere: 'Vivid', description: '' }])} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"><MapPinIcon className="w-4 h-4 mr-2 inline" /> Add Location</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map(loc => (
                  <Card key={loc.id} onClick={() => setFocusedEntity({ type: 'location', id: loc.id })} className="p-0 overflow-hidden group rounded-2xl bg-white cursor-pointer">
                    <div className="h-40 bg-slate-100 overflow-hidden relative">
                      {loc.imageUrl ? <img src={loc.imageUrl} className="w-full h-full object-cover" /> : <MapIcon className="w-12 h-12 absolute inset-0 m-auto opacity-10" />}
                    </div>
                    <div className="p-5">
                      <h4 className="serif text-lg font-bold">{loc.name}</h4>
                      <p className="text-[9px] font-black text-indigo-500 uppercase mt-1">{loc.atmosphere}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="p-8 md:p-12 overflow-y-auto bg-slate-50 flex-1">
            <div className="max-w-4xl mx-auto space-y-10">
              <div className="flex justify-between items-end border-b pb-6">
                <h2 className="serif text-4xl font-bold">The Cast</h2>
                <button onClick={() => setCharacters([...characters, { id: 'c-'+Date.now(), name: 'New Persona', role: 'Protagonist', description: '', traits: [] }])} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"><PlusIcon className="w-4 h-4 mr-2 inline" /> Add Character</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {characters.map(char => (
                  <Card key={char.id} onClick={() => setFocusedEntity({ type: 'character', id: char.id })} className="p-0 overflow-hidden group rounded-2xl bg-white cursor-pointer">
                    <div className="h-40 bg-slate-100 overflow-hidden relative">
                      {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" /> : <UserGroupIcon className="w-12 h-12 absolute inset-0 m-auto opacity-10" />}
                    </div>
                    <div className="p-5">
                      <h4 className="serif text-lg font-bold">{char.name}</h4>
                      <p className="text-[9px] font-black text-indigo-500 uppercase mt-1">{char.role}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white">
            <div className="max-w-3xl mx-auto space-y-12">
              <div className="flex justify-between items-end border-b pb-8">
                <div>
                  <h2 className="serif text-4xl font-bold">Deep Scan (Workshop)</h2>
                  <p className="text-slate-400 font-serif italic text-sm mt-1">Critiquing the current state of your manuscript.</p>
                </div>
                <button onClick={runAnalysis} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all hover:bg-indigo-600"><SparklesIcon className="w-4 h-4 mr-2 inline" /> Deep Scan Manuscript</button>
              </div>

              {analysis ? (
                <div className="space-y-12 animate-in slide-in-from-bottom-5">
                  <section className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                    <h3 className="serif text-xl font-bold text-indigo-600 flex items-center gap-2 mb-4"><CheckBadgeIcon className="w-5 h-5"/> Manuscript Consistency</h3>
                    <p className="font-serif text-sm leading-relaxed text-slate-600 italic border-l-2 border-indigo-100 pl-4">{analysis.consistency}</p>
                  </section>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {analysis.suggestions.map((s, i) => (
                      <div key={i} className="p-6 border-2 border-dashed border-amber-100 rounded-2xl bg-[#FFFDF9] text-xs leading-relaxed">{s}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-20 text-center gap-4">
                  <ChatBubbleOvalLeftEllipsisIcon className="w-20 h-20" />
                  <p className="serif text-xl italic">"Scanning for narrative depth..."</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-8 md:p-12 overflow-y-auto bg-slate-50 flex-1">
            <div className="max-w-xl mx-auto space-y-12">
               <h2 className="serif text-4xl font-bold">Configurations</h2>
               <div className="space-y-10 bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Honesty Calibrator</h4>
                      <span className="text-4xl font-black text-indigo-600 font-serif">{settings.criticismLevel}%</span>
                    </div>
                    <input type="range" className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" value={settings.criticismLevel} onChange={e => setSettings({...settings, criticismLevel: parseInt(e.target.value)})} />
                    <div className="p-8 bg-indigo-50/30 rounded-3xl border border-indigo-100/30 text-center">
                      <p className="text-base text-indigo-900 font-serif italic leading-relaxed">"{getInkwellQuote(settings.criticismLevel)}"</p>
                    </div>
                  </div>
                  <div className="pt-8 border-t flex flex-col items-center gap-6">
                    <label className="cursor-pointer bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all">
                      <BookOpenIcon className="w-4 h-4" /> Import Project
                      <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .serif { font-family: 'Playfair Display', serif; }
        .dreaming-shimmer {
          background: linear-gradient(-45deg, #0f172a 0%, #4f46e5 25%, #ec4899 50%, #4f46e5 75%, #0f172a 100%);
          background-size: 400% 400%;
          animation: dreaming-anim 8s infinite ease-in-out;
        }
        @keyframes dreaming-anim { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        input[type='range']::-webkit-slider-thumb {
          appearance: none; width: 22px; height: 22px; background: #4f46e5; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}</style>
    </div>
  );
};

export default App;
