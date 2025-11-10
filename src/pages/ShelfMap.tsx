import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Info, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Book {
  id: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  category?: string | null;
  shelf_code?: string | null;
}

interface Shelf {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

const shelves: Shelf[] = [
  { id: 'A1', x: 50, y: 50, width: 150, height: 80, color: 'primary', label: 'Fiction A-F' },
  { id: 'A2', x: 250, y: 50, width: 150, height: 80, color: 'primary', label: 'Fiction G-M' },
  { id: 'A3', x: 450, y: 50, width: 150, height: 80, color: 'primary', label: 'Fiction N-Z' },
  { id: 'B1', x: 50, y: 180, width: 150, height: 80, color: 'secondary', label: 'Non-Fiction A-M' },
  { id: 'B2', x: 250, y: 180, width: 150, height: 80, color: 'secondary', label: 'Non-Fiction N-Z' },
  { id: 'B3', x: 450, y: 180, width: 150, height: 80, color: 'secondary', label: 'Science & Tech' },
  { id: 'C1', x: 50, y: 310, width: 150, height: 80, color: 'accent', label: 'History' },
  { id: 'C2', x: 250, y: 310, width: 150, height: 80, color: 'accent', label: 'Art & Culture' },
  { id: 'C3', x: 450, y: 310, width: 150, height: 80, color: 'accent', label: 'Reference' },
];

const categories = [
  { color: 'primary', label: 'Fiction', description: 'Novels and literary works' },
  { color: 'secondary', label: 'Non-Fiction', description: 'Educational and informative books' },
  { color: 'accent', label: 'Special Collections', description: 'History, art, and reference materials' },
];

const categoryText: Record<string, { en: { label: string; desc: string }, ar: { label: string; desc: string } }> = {
  primary: {
    en: { label: 'Fiction', desc: 'Novels and literary works' },
    ar: { label: 'الأدب', desc: 'روايات وأعمال أدبية' },
  },
  secondary: {
    en: { label: 'Non-Fiction', desc: 'Educational and informative books' },
    ar: { label: 'غير روائي', desc: 'كتب تعليمية ومعلوماتية' },
  },
  accent: {
    en: { label: 'Special Collections', desc: 'History, art, and reference materials' },
    ar: { label: 'مجموعات خاصة', desc: 'تاريخ وفن ومواد مرجعية' },
  },
};

// Unified placeholder used when images fail to load
const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=800&fit=crop';

// Storage bucket name for covers (aligns with Admin page)
const COVERS_BUCKET = import.meta.env.VITE_SUPABASE_COVERS_BUCKET || 'book-covers';

// Helper to resolve a cover image src. Supports:
// - Full URLs
// - Storage paths like "covers/filename.jpg"
// - Fallback to a placeholder if missing
const resolveCoverSrc = (url?: string | null) => {
  if (!url) return PLACEHOLDER_IMG;
  if (/^https?:\/\//.test(url)) return url;
  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(url);
  return data?.publicUrl || PLACEHOLDER_IMG;
};

const ShelfMap: React.FC = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const targetLocation = searchParams.get('location');
  const [selectedShelf, setSelectedShelf] = useState<string | null>(targetLocation);
  const isArabic = language === 'ar';

  // Books state and realtime sync
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState<boolean>(false);

  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) setBooks(data as Book[]);
    setLoadingBooks(false);
  }, []);

  useEffect(() => {
    fetchBooks();
    const channel = supabase
      .channel('books-shelf-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        fetchBooks();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBooks]);

  // Group books into drawers by shelf_code
  const drawers = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const b of books) {
      const code = (b.shelf_code || 'غير محدد');
      const arr = map.get(code) || [];
      arr.push(b);
      map.set(code, arr);
    }
    return Array.from(map.entries()).map(([code, list]) => ({ code, list }));
  }, [books]);

  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>({});
  const drawerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightBookId, setHighlightBookId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const [modalImageError, setModalImageError] = useState<string | null>(null);

  // Search across all drawers
  const [q, setQ] = useState('');
  const searchResults = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as Book[];
    return books.filter(b =>
      (b.title || '').toLowerCase().includes(term) ||
      (b.author || '').toLowerCase().includes(term) ||
      (b.category || '').toLowerCase().includes(term)
    ).slice(0, 10);
  }, [q, books]);

  const jumpToBook = (book: Book) => {
    const code = book.shelf_code || 'غير محدد';
    setSelectedShelf(code);
    setOpenDrawers(s => ({ ...s, [code]: true }));
    setHighlightBookId(book.id);
    setTimeout(() => {
      const el = drawerRefs.current[code];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="min-h-screen pt-24 px-6 pb-12">
      <div className={`max-w-7xl mx-auto space-y-8 animate-fade-in ${isArabic ? 'rtl' : ''}`}>
        {/* Header with title and help dialog */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <MapPin className="w-8 sm:w-10 h-8 sm:h-10 text-primary" />
            {t('home.shelf.title')}
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                {t('home.shelf.desc')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('home.shelf.title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                {isArabic ? (
                  <>
                    <p>• اضغط على أي درج لعرض الكتب بداخله بالكامل.</p>
                    <p>• استخدم البحث للوصول السريع إلى الكتاب المطلوب عبر جميع الأدراج.</p>
                    <p>• عند اختيار نتيجة، سيتم فتح الدرج المناسب مع تمييز الكتاب.</p>
                  </>
                ) : (
                  <>
                    <p>• Click any drawer to view all books inside.</p>
                    <p>• Use search to quickly find a book across all drawers.</p>
                    <p>• Selecting a result opens the right drawer and highlights the book.</p>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Legend */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary via-secondary to-accent rounded-full" />
            Category Legend
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.color}
                className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/50 transition-smooth"
              >
                <div
                  className="w-12 h-12 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: `hsl(var(--${category.color}))` }}
                />
                <div>
                  <h4 className="font-semibold">{category.label}</h4>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Map */}
        <Card className="p-8 shadow-apple-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{isArabic ? 'الطابق الثاني - المكتبة الرئيسية' : 'Floor 2 - Main Library'}</h3>
              {selectedShelf && (
                <Badge variant="default" className="animate-scale-in">
                  <MapPin className="w-3 h-3 mr-1" />
                  {isArabic ? 'المحدد:' : 'Selected:'} {shelves.find(s => s.id === selectedShelf)?.label}
                </Badge>
              )}
            </div>
            {/* Search bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Input
                placeholder={isArabic ? 'ابحث عبر جميع الأدراج' : 'Search across all drawers'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q.trim() && searchResults.length > 0 && (
                <div className="bg-white border rounded-lg p-2 w-full sm:w-auto max-w-xl shadow-apple">
                  {searchResults.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => jumpToBook(b)}
                      className="w-full text-left text-sm p-2 rounded hover:bg-muted flex items-center gap-2"
                    >
                      <img
                        src={resolveCoverSrc(b.cover_url)}
                        alt={b.title}
                        className="w-8 h-10 object-cover rounded"
                        loading="lazy"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                      />
                      <span className="font-medium truncate">{b.title}</span>
                      <span className="text-muted-foreground truncate">• {b.author}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{b.shelf_code || (isArabic ? 'غير محدد' : 'Unspecified')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <svg
                viewBox="0 0 700 450"
                className="w-full h-auto border border-border rounded-lg"
                style={{ maxHeight: '600px' }}
              >
                {/* Floor Grid */}
                <defs>
                  <pattern
                    id="grid"
                    width="50"
                    height="50"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 50 0 L 0 0 0 50"
                      fill="none"
                      stroke="hsl(var(--border))"
                      strokeWidth="0.5"
                    />
                  </pattern>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <rect width="700" height="450" fill="url(#grid)" />

                {/* Entrance marker */}
                <g>
                  <rect x="325" y="420" width="50" height="20" fill="hsl(var(--muted))" rx="4" />
                  <text
                    x="350"
                    y="433"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    ENTRANCE
                  </text>
                </g>

                {/* Shelves */}
                {shelves.map((shelf) => (
                  <g
                    key={shelf.id}
                    onClick={() => {
                      setSelectedShelf(shelf.id);
                      setOpenDrawers(s => ({ ...s, [shelf.id]: true }));
                      setTimeout(() => {
                        const el = drawerRefs.current[shelf.id];
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 50);
                    }}
                    className="cursor-pointer transition-smooth"
                    style={{
                      transform:
                        selectedShelf === shelf.id ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: `${shelf.x + shelf.width / 2}px ${
                        shelf.y + shelf.height / 2
                      }px`,
                    }}
                  >
                    <rect
                      x={shelf.x}
                      y={shelf.y}
                      width={shelf.width}
                      height={shelf.height}
                      fill={`hsl(var(--${shelf.color}))`}
                      opacity={selectedShelf === shelf.id ? '1' : '0.8'}
                      rx="8"
                      className="transition-smooth"
                      filter={selectedShelf === shelf.id ? 'url(#glow)' : 'none'}
                      stroke={selectedShelf === shelf.id ? 'hsl(var(--primary))' : 'transparent'}
                      strokeWidth="3"
                    />
                    <text
                      x={shelf.x + shelf.width / 2}
                      y={shelf.y + shelf.height / 2 - 8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="16"
                      fontWeight="bold"
                    >
                      {shelf.id}
                    </text>
                    <text
                      x={shelf.x + shelf.width / 2}
                      y={shelf.y + shelf.height / 2 + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="11"
                      opacity="0.9"
                    >
                      {shelf.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </Card>

        {/* Selected shelf details */}
        {selectedShelf && (
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30 animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  Shelf {selectedShelf} - {shelves.find(s => s.id === selectedShelf)?.label}
                </h3>
                <div className="space-y-2 text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    <span className="font-semibold">{isArabic ? 'الموقع:' : 'Location:'}</span> {isArabic ? 'الطابق الثاني، المكتبة الرئيسية' : 'Floor 2, Main Library'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span className="font-semibold">{isArabic ? 'الفئة:' : 'Category:'}</span> {
                      (() => {
                        const color = shelves.find(s => s.id === selectedShelf)?.color || 'primary';
                        const texts = categoryText[color];
                        return isArabic ? texts.ar.label : texts.en.label;
                      })()
                    }
                  </p>
                  <p className="mt-3 p-3 bg-background rounded-lg border border-border">
                    💡 <strong>{isArabic ? 'نصيحة للتنقل:' : 'Navigation Tip:'}</strong> {isArabic ? 'استخدم المدخل أسفل الخريطة.' : 'Use the entrance at the bottom of the map.'} 
                    {isArabic ? 'يقع هذا الرف في ' : 'This shelf is located in the '}
                    {shelves.find(s => s.id === selectedShelf)?.x < 200 ? 'left' : 
                     shelves.find(s => s.id === selectedShelf)?.x < 350 ? 'center' : 'right'} section.
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const el = drawerRefs.current[selectedShelf!];
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setOpenDrawers(s => ({ ...s, [selectedShelf!]: true }));
                      }}
                    >
                      {isArabic ? `انتقل إلى الدرج ${selectedShelf}` : `Go to drawer ${selectedShelf}`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Drawers with books */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{isArabic ? 'الأدراج والكتب' : 'Drawers & Books'}</h3>
            <span className="text-sm text-muted-foreground">{books.length} {isArabic ? 'كتاب' : 'books'}</span>
          </div>
          {loadingBooks && (
            <p className="text-muted-foreground">{isArabic ? 'جارِ تحميل الكتب...' : 'Loading books...'}</p>
          )}
          {!loadingBooks && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drawers.map(({ code, list }) => (
                <div
                  key={code}
                  ref={(el) => { drawerRefs.current[code] = el; }}
                  className="rounded-xl border p-4 bg-white"
                >
                  <button
                    className="w-full text-left font-semibold mb-3 flex items-center justify-between"
                    onClick={() => setOpenDrawers(s => ({ ...s, [code]: !s[code] }))}
                  >
                    <span>{isArabic ? 'رف:' : 'Shelf:'} {code}</span>
                    <span className="text-xs text-muted-foreground">{openDrawers[code] ? (isArabic ? 'إخفاء' : 'Hide') : (isArabic ? 'عرض' : 'Show')} • {list.length} {isArabic ? 'كتاب' : 'books'}</span>
                  </button>
                  {openDrawers[code] && (
                    <div className="space-y-3">
                      {list.map((b) => (
                        <div
                          key={b.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border hover:border-primary transition-smooth ${highlightBookId === b.id ? 'bg-primary/10 border-primary' : 'bg-background'}`}
                          onClick={() => {
                            // Preload image to improve immediate display in the modal
                            const src = resolveCoverSrc(b.cover_url);
                            const img = new Image();
                            img.src = src;
                            // decode() is supported in modern browsers; fallback silently
                            if ((img as any).decode) {
                              (img as any).decode().catch(() => {});
                            }
                            setModalImageLoaded(false);
                            setModalImageError(null);
                            setSelectedBook(b);
                          }}
                          onMouseEnter={() => {
                            // Warm cache for smoother opening
                            const src = resolveCoverSrc(b.cover_url);
                            const img = new Image();
                            img.src = src;
                          }}
                        >
                          <div className="w-12 h-16 overflow-hidden rounded-md flex-shrink-0">
                            <img
                              src={resolveCoverSrc(b.cover_url)}
                              alt={b.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                              onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{b.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{b.author}</p>
                            <p className="text-xs text-muted-foreground truncate">{b.category}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Book details modal */}
        <Dialog open={!!selectedBook} onOpenChange={(open) => { if (!open) { setSelectedBook(null); setModalImageError(null); setModalImageLoaded(false); } }}>
          <DialogContent>
            {selectedBook && (
              <div className="space-y-4">
                <div className="aspect-[3/4] w-full max-w-[85vw] sm:max-w-[380px] md:max-w-[480px] mx-auto overflow-hidden rounded-lg border relative">
                  {!modalImageLoaded && !modalImageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                      <div className="animate-pulse text-sm text-muted-foreground">{isArabic ? 'جارِ تحميل الصورة...' : 'Loading image...'}</div>
                    </div>
                  )}
                  <img
                    src={resolveCoverSrc(selectedBook.cover_url)}
                    alt={selectedBook.title}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${modalImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    loading="eager"
                    decoding="async"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onLoad={() => setModalImageLoaded(true)}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                      setModalImageError(isArabic ? 'تعذّر تحميل الصورة' : 'Failed to load image');
                      // Ensure placeholder becomes visible
                      setModalImageLoaded(true);
                    }}
                    fetchpriority="high"
                  />
                </div>
                {modalImageError && (
                  <p className="text-sm text-destructive text-center">{modalImageError}</p>
                )}
                <div className="space-y-1">
                  <p className="text-lg font-bold">{selectedBook.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {(isArabic ? 'المؤلف:' : 'Author:')} {selectedBook.author || (isArabic ? 'غير معروف' : 'Unknown')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(isArabic ? 'الفئة:' : 'Category:')} {selectedBook.category || (isArabic ? 'غير مصنّف' : 'Uncategorized')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(isArabic ? 'الرف:' : 'Shelf:')} {selectedBook.shelf_code || (isArabic ? 'غير محدد' : 'Unspecified')}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ShelfMap;