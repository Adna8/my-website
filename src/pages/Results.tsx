import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Book {
  id: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  category?: string | null;
  shelf_code?: string | null;
}

const Results: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .or(`title.ilike.${like},author.ilike.${like},category.ilike.${like}`);
    if (!error && data) setBooks(data as Book[]);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    if (query.trim()) fetchBooks();
    else setBooks([]);
  }, [query, fetchBooks]);

  // Realtime: refresh results when books change
  useEffect(() => {
    if (!query.trim()) return;
    const channel = supabase.channel('books-results-sync').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'books' },
      () => { fetchBooks(); }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [query, fetchBooks]);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-8 sm:pb-12">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold">{t('results.title')}</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Search results for: <span className="text-primary font-medium break-all">"{query}"</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading && (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground text-base sm:text-lg">{t('results.loading')}</p>
            </div>
          )}
          {!loading && books.length === 0 && (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground text-base sm:text-lg">{t('results.notFound')}</p>
            </div>
          )}
          {!loading && books.map((book, index) => (
            <div
              key={book.id}
              className="group bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 border-transparent hover:border-primary shadow-apple hover:shadow-apple-lg transition-smooth cursor-pointer animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => navigate(`/book/${book.id}`)}
            >
              <div className="aspect-[3/4] mb-3 sm:mb-4 overflow-hidden rounded-lg sm:rounded-xl">
                <img
                  src={book.cover_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop'}
                  alt={book.title}
                  className="w-full h-full object-cover transition-smooth group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2 line-clamp-2">{book.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 line-clamp-1">{book.author}</p>
              <Button className="w-full bg-secondary hover:bg-secondary/90 transition-smooth text-sm sm:text-base py-2 h-auto">
                {t('results.details')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Results;