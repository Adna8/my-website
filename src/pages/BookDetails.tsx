import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { MapPin, User, BookOpen } from 'lucide-react';

const BookDetails: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock book data
  const book = {
    id: id,
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&h=1200&fit=crop',
    category: 'Fiction',
    shelf: 'A2',
    floor: '2',
    description:
      'A classic American novel set in the 1920s, following the mysterious millionaire Jay Gatsby and his obsession with Daisy Buchanan.',
  };

  return (
    <div className="min-h-screen pt-24 px-6 pb-12">
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Book Cover */}
          <div className="space-y-6">
            <div className="aspect-[3/4] overflow-hidden rounded-3xl shadow-apple-lg">
              <img
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Book Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-bold mb-4">{book.title}</h1>
              <div className="flex items-center space-x-2 text-xl text-muted-foreground mb-6">
                <User className="w-5 h-5" />
                <span>{t('book.author')}: {book.author}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-xl">
                <BookOpen className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('book.category')}</p>
                  <p className="font-semibold text-lg">{book.category}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-primary/10 rounded-xl">
                <MapPin className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('book.location')}</p>
                  <p className="font-semibold text-lg">
                    Shelf {book.shelf}, Floor {book.floor}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground">
              {book.description}
            </p>

            <Button
              onClick={() => navigate(`/shelf?location=${book.shelf}`)}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-smooth text-lg py-6"
            >
              <MapPin className="w-5 h-5 mr-2" />
              {t('book.viewMap')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetails;