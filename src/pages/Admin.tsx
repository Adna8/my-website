import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, TrendingUp, Users, Plus, Trash2, Pencil, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Book {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  category?: string | null;
  isbn?: string | null;
  cover_url?: string | null;
  shelf_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// اسم حاوية التخزين للصور، قابل للتهيئة عبر البيئة
const COVERS_BUCKET = import.meta.env.VITE_SUPABASE_COVERS_BUCKET || 'book-covers';

// صورة بديلة موحّدة عند تعذّر التحميل
const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=450&fit=crop&auto=format&dpr=1';

// حلّ مصدر الصورة: يدعم الروابط الكاملة ومسارات التخزين
function resolveCoverSrc(coverUrl?: string | null): string {
  const url = (coverUrl || '').trim();
  if (!url) return PLACEHOLDER_IMG;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // في حال كانت قيمة الغلاف مسارًا داخل الحاوية
  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(url);
  return data?.publicUrl || PLACEHOLDER_IMG;
}

const Admin: React.FC = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'books' | 'shelves' | 'loans' | 'analytics'>('books');

  // Books state
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Dialog state for Add/Edit
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<Partial<Book>>({ title: '', author: '', category: '', cover_url: '', isbn: '', shelf_code: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setForm({ title: '', author: '', category: '', cover_url: '', isbn: '', shelf_code: '' });
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast({ title: language === 'ar' ? 'صيغة غير مدعومة' : 'Unsupported format', description: language === 'ar' ? 'الرجاء اختيار JPG أو PNG أو GIF' : 'Please choose JPG, PNG or GIF', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${search}%`;
      let query = supabase.from('books').select('*');
      if (search.trim()) {
        query = query.or(`title.ilike.${like},author.ilike.${like},category.ilike.${like}`);
      }
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }
      const { data, error } = await query.order('updated_at', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      setBooks((data || []) as Book[]);
    } catch (err: any) {
      toast({ title: language === 'ar' ? 'خطأ في جلب الكتب' : 'Failed to fetch books', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, toast, language]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchBooks(); }, 250);
    return () => clearTimeout(timer);
  }, [fetchBooks]);

  // Realtime subscription to reflect changes immediately
  useEffect(() => {
    const channel = supabase.channel('books-admin-sync').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'books' },
      () => {
        fetchBooks();
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBooks]);

  const onEdit = (book: Book) => {
    setEditing(book);
    setForm({
      title: book.title || '',
      author: book.author || '',
      category: book.category || '',
      cover_url: book.cover_url || '',
      isbn: book.isbn || '',
      shelf_code: book.shelf_code || ''
    });
    setOpenDialog(true);
  };

  const onDelete = async (book: Book) => {
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      toast({ title: language === 'ar' ? 'فشل الحذف' : 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: language === 'ar' ? 'تم حذف الكتاب' : 'Book deleted' });
      fetchBooks();
    }
  };

  const performSave = async () => {
    const payload: any = {
      title: (form.title || '').trim(),
      author: (form.author || '') || null,
      category: (form.category || '') || null,
      cover_url: (form.cover_url || '') || null,
      isbn: (form.isbn || '') || null,
      shelf_code: (form.shelf_code || '') || null,
    };

    try {
      if (!payload.title) {
        toast({ title: language === 'ar' ? 'العنوان مطلوب' : 'Title is required', variant: 'destructive' });
        return;
      }

      // Upload selected file to Supabase Storage if present
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from(COVERS_BUCKET).upload(path, selectedFile, {
          contentType: selectedFile.type,
          upsert: true,
        });
        if (uploadError) {
          // تابع الحفظ بدون صورة في حال عدم وجود الحاوية أو أي خطأ رفع
          toast({
            title: language === 'ar' ? 'تعذّر رفع الصورة' : 'Image upload failed',
            description: language === 'ar' ? `تحقّق من وجود الحاوية ${COVERS_BUCKET}. سيتم الحفظ دون صورة.` : `Ensure bucket ${COVERS_BUCKET} exists. Saving without image.`,
            variant: 'destructive',
          });
        } else {
          const { data: publicUrlData } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
          payload.cover_url = publicUrlData.publicUrl;
        }
      }

      if (editing) {
        const { error } = await supabase.from('books').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: language === 'ar' ? 'تم تحديث الكتاب' : 'Book updated' });
      } else {
        const { error } = await supabase.from('books').insert(payload);
        if (error) throw error;
        toast({ title: language === 'ar' ? 'تم إضافة كتاب' : 'Book added' });
      }

      setShowConfirmSave(false);
      setOpenDialog(false);
      resetForm();
      fetchBooks();
    } catch (err: any) {
      toast({ title: language === 'ar' ? 'فشل الحفظ' : 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmSave(true);
  };

  // Shelves view: group books by shelf_code and enable drag-and-drop
  const shelves = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const b of books) {
      const code = (b.shelf_code || 'غير محدد');
      const arr = map.get(code) || [];
      arr.push(b);
      map.set(code, arr);
    }
    return Array.from(map.entries()).map(([code, list]) => ({ code, list }));
  }, [books]);

  // Shelves UI state: collapsible drawers and sorting/filtering
  const [openShelves, setOpenShelves] = useState<Record<string, boolean>>({});
  const [shelvesSearch, setShelvesSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortBooks = (list: Book[]) => {
    const copied = [...list];
    copied.sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (sortBy === 'date') {
        va = a.created_at ? new Date(a.created_at).getTime() : 0;
        vb = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else if (sortBy === 'title') {
        va = (a.title || '').toLowerCase();
        vb = (b.title || '').toLowerCase();
      } else if (sortBy === 'category') {
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
      }
      if (va === vb) return 0;
      const cmp = va! > vb! ? 1 : -1;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return copied;
  };

  const onDragStart = (e: React.DragEvent, bookId: string) => {
    e.dataTransfer.setData('text/plain', bookId);
  };

  const onDropToShelf = async (e: React.DragEvent, shelfCode: string) => {
    e.preventDefault();
    const bookId = e.dataTransfer.getData('text/plain');
    if (!bookId) return;
    const { error } = await supabase.from('books').update({ shelf_code: shelfCode }).eq('id', bookId);
    if (error) {
      toast({ title: language === 'ar' ? 'فشل نقل الكتاب' : 'Move failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: language === 'ar' ? 'تم نقل الكتاب' : 'Book moved' });
      fetchBooks();
    }
  };

  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const tabs = [
    { id: 'books' as const, icon: BookOpen, label: t('admin.books') },
    { id: 'shelves' as const, icon: Layers, label: language === 'ar' ? 'الرفوف' : 'Shelves' },
    { id: 'loans' as const, icon: Users, label: t('admin.loans') },
    { id: 'analytics' as const, icon: TrendingUp, label: t('admin.analytics') },
  ];

  return (
    <div className="min-h-screen pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto animate-fade-in">
        <h1 className="text-4xl font-bold mb-8">{t('admin.title')}</h1>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-apple p-4 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-smooth ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-apple'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl shadow-apple-lg p-8">
              {activeTab === 'books' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
                    <h2 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الكتب' : 'Manage Books'}</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder={language === 'ar' ? 'بحث بالعنوان/المؤلف/التصنيف' : 'Search by title/author/category'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <Input
                        placeholder={language === 'ar' ? 'تصفية التصنيف (اختياري)' : 'Filter category (optional)'}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      />
                      <Button onClick={() => { resetForm(); setOpenDialog(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        {language === 'ar' ? 'إضافة كتاب' : 'Add Book'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {loading && (
                      <div className="text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</div>
                    )}
                    {!loading && books.length === 0 && (
                      <div className="text-muted-foreground">{language === 'ar' ? 'لا توجد كتب' : 'No books found'}</div>
                    )}
                    {!loading && books.map((book) => (
                      <div key={book.id} className="flex items-center justify-between p-4 border-2 border-muted rounded-xl hover:border-primary transition-smooth">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-16 overflow-hidden rounded bg-muted">
                            <img
                              src={resolveCoverSrc(book.cover_url)}
                              alt={book.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold">{book.title}</h3>
                            <p className="text-sm text-muted-foreground">{book.author || (language === 'ar' ? 'بدون مؤلف' : 'No author')}</p>
                            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'تصنيف:' : 'Category:'} {book.category || (language === 'ar' ? 'غير محدد' : 'N/A')}</p>
                            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'رف:' : 'Shelf:'} {book.shelf_code || (language === 'ar' ? 'غير محدد' : 'N/A')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => onEdit(book)}>
                            <Pencil className="w-4 h-4 mr-1" /> {language === 'ar' ? 'تعديل' : 'Edit'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => onDelete(book)}>
                            <Trash2 className="w-4 h-4 mr-1" /> {language === 'ar' ? 'حذف' : 'Delete'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add/Edit Dialog */}
                  {openDialog && (
                    <Dialog open={openDialog} onOpenChange={(o) => setOpenDialog(o)}>
                      <div className="fixed inset-0 bg-black/20" />
                      <div className="fixed inset-0 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-lg p-6">
                          <h3 className="text-xl font-bold mb-4">{editing ? (language === 'ar' ? 'تعديل كتاب' : 'Edit Book') : (language === 'ar' ? 'إضافة كتاب' : 'Add Book')}</h3>
                          <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'العنوان' : 'Title'}</Label>
                              <Input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'المؤلف' : 'Author'}</Label>
                              <Input value={form.author || ''} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'التصنيف' : 'Category'}</Label>
                              <Input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'صورة الغلاف' : 'Cover Image'}</Label>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <Input type="file" accept="image/png,image/jpeg,image/gif" onChange={handleFileChange} />
                                <Button type="button" variant="outline" onClick={clearSelectedFile}>{language === 'ar' ? 'إزالة الصورة' : 'Remove Image'}</Button>
                              </div>
                              {(previewUrl || form.cover_url) && (
                                <div className="mt-3 w-24 h-36 overflow-hidden rounded-xl border bg-muted">
                                  <img
                                    src={previewUrl || resolveCoverSrc(form.cover_url || '')}
                                    alt="cover preview"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'رابط صورة الغلاف' : 'Cover URL'}</Label>
                              <Input value={form.cover_url || ''} onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'ISBN (اختياري)' : 'ISBN (optional)'}</Label>
                              <Input value={form.isbn || ''} onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>{language === 'ar' ? 'كود الرف (اختياري)' : 'Shelf Code (optional)'}</Label>
                              <Input value={form.shelf_code || ''} onChange={(e) => setForm((f) => ({ ...f, shelf_code: e.target.value }))} />
                            </div>
                            {/* ملاحظة: حقل "تاريخ النشر" غير متوفر في المخطط الحالي للقاعدة. */}
                            <div className="flex justify-end gap-2 pt-4">
                              <Button type="button" variant="outline" onClick={() => { setOpenDialog(false); resetForm(); }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                              <Button type="submit">{language === 'ar' ? 'حفظ' : 'Save'}</Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </Dialog>
                  )}
                  {/* حفظ تأكيدي */}
                  <AlertDialog open={showConfirmSave} onOpenChange={setShowConfirmSave}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{language === 'ar' ? 'تأكيد الحفظ' : 'Confirm Save'}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {language === 'ar' ? 'هل تريد حفظ التغييرات؟' : 'Do you want to save changes?'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={performSave}>{language === 'ar' ? 'حفظ' : 'Save'}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {activeTab === 'shelves' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">{language === 'ar' ? 'إدارة الرفوف' : 'Manage Shelves'}</h2>
                    <p className="text-muted-foreground text-sm">{language === 'ar' ? 'اسحب الكتاب وأسقطه لنقلِه بين الرفوف' : 'Drag a book and drop it to move between shelves'}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <Input placeholder={language === 'ar' ? 'بحث ضمن الكتب' : 'Search within books'} value={shelvesSearch} onChange={(e) => setShelvesSearch(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">{language === 'ar' ? 'ترتيب حسب' : 'Sort by'}</label>
                      <select className="border rounded-md px-2 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="date">{language === 'ar' ? 'التاريخ' : 'Date'}</option>
                        <option value="title">{language === 'ar' ? 'العنوان' : 'Title'}</option>
                        <option value="category">{language === 'ar' ? 'التصنيف' : 'Category'}</option>
                      </select>
                      <select className="border rounded-md px-2 py-1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
                        <option value="asc">{language === 'ar' ? 'تصاعدي' : 'Asc'}</option>
                        <option value="desc">{language === 'ar' ? 'تنازلي' : 'Desc'}</option>
                      </select>
                    </div>
                  </div>
                  <div className={`grid ${language === 'ar' ? 'rtl' : ''} grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}>
                    {shelves.map(({ code, list }) => (
                      <div
                        key={code}
                        className="rounded-2xl border-2 border-muted p-4 min-h-[180px] bg-white"
                        onDragOver={allowDrop}
                        onDrop={(e) => onDropToShelf(e, code === 'غير محدد' ? '' : code)}
                      >
                        <button className="w-full text-left font-semibold mb-3 flex items-center justify-between" onClick={() => setOpenShelves((s) => ({ ...s, [code]: !s[code] }))}>
                          <span>{language === 'ar' ? 'رف:' : 'Shelf:'} {code}</span>
                          <span className="text-xs text-muted-foreground">{(openShelves[code] ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'عرض' : 'Show'))} • {list.length} {language === 'ar' ? 'كتاب' : 'books'}</span>
                        </button>
                        {openShelves[code] && (
                          <div className="space-y-3">
                          {sortBooks(list).filter((b) => {
                            const q = shelvesSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              (b.title || '').toLowerCase().includes(q) ||
                              (b.author || '').toLowerCase().includes(q) ||
                              (b.category || '').toLowerCase().includes(q)
                            );
                          }).map((b) => (
                            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-12 overflow-hidden rounded bg-muted">
                                  <img
                                    src={resolveCoverSrc(b.cover_url)}
                                    alt={b.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                                  />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{b.title}</div>
                                  <div className="text-xs text-muted-foreground">{b.author || (language === 'ar' ? 'بدون مؤلف' : 'No author')}</div>
                                  <div className="text-[11px] text-muted-foreground">{language === 'ar' ? 'تاريخ الإضافة' : 'Added'}: {b.created_at ? new Date(b.created_at).toLocaleDateString() : (language === 'ar' ? 'غير متاح' : 'N/A')}</div>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" draggable onDragStart={(e) => onDragStart(e, b.id)}>
                                {language === 'ar' ? 'نقل' : 'Move'}
                              </Button>
                            </div>
                          ))}
                          {list.length === 0 && (
                            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'لا توجد كتب في هذا الرف' : 'No books in this shelf'}</div>
                          )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'loans' && (
                <div className="text-muted-foreground">{language === 'ar' ? 'ميزة القروض قيد التطوير' : 'Loans feature under development'}</div>
              )}
              {activeTab === 'analytics' && (
                <div className="text-muted-foreground">{language === 'ar' ? 'تقارير التحليلات قريبًا' : 'Analytics coming soon'}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;