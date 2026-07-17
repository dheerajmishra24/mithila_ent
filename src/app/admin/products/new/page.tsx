"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { UploadCloud, Sparkles, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { createProduct, uploadProductImage } from '@/actions/admin';

export default function AIProductIngestion() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [baseName, setBaseName] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const supabase = createClient();
  const router = useRouter();
  
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [newColor, setNewColor] = useState('');
  const [publishing, setPublishing] = useState(false);

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    weaveDensity: '',
    pigment: '',
    count: '',
    construction: '',
    pricePerMeter: 0,
    colors: [] as string[],
    categoryId: '',
    collectionIds: [] as string[],
    gsm: 320,
    minOrderQuantity: 1,
    width: '54 inches / 137 cm',
    stretch: '0% Mechanical Stretch',
    origin: 'Mithila Artisanal Cluster, India',
    bestSuitedFor: 'Tailored overcoats, Unlined summer blazers, Dense upholstery',
    print: ''
  });

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) setCategories(data);
    });
    supabase.from('collections').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setCollections(data);
    });
  }, [supabase]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !imagePreview) return;

    setStep('scanning');

    try {
      const res = await fetch('/api/extract-fabric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imagePreview, baseName })
      });

      if (!res.ok) {
        let errMessage = `Server error ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData.error || errMessage;
        } catch {
          const errText = await res.text();
          console.error("Server returned non-JSON:", errText.substring(0, 200));
          errMessage = `Server returned ${res.status} ${res.statusText}. Check console for details.`;
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      
      setDraft({
        title: data.title || baseName || '',
        description: data.description || '',
        weaveDensity: data.weaveDensity || '',
        pigment: data.pigment || '',
        count: data.count || '',
        construction: data.construction || '',
        pricePerMeter: 0, 
        colors: Array.isArray(data.colors) ? data.colors : [],
        categoryId: categories.length > 0 ? categories[0].id : '',
        collectionIds: [],
        gsm: parseInt(data.gsm) || 320,
        minOrderQuantity: 1,
        width: data.width || '54 inches / 137 cm',
        stretch: data.stretch || '0% Mechanical Stretch',
        origin: data.origin || 'Mithila Artisanal Cluster, India',
        bestSuitedFor: data.bestSuitedFor || '',
        print: data.print || ''
      });

      setStep('review');
    } catch (error: any) {
      console.error(error);
      alert('Extraction failed: ' + error.message);
      setStep('upload');
    }
  };

  const handleManualEntry = () => {
    // Skip AI extraction: jump straight to the editable ledger with sensible
    // defaults so the owner can add a product by hand (no image required).
    setDraft((d) => ({ ...d, categoryId: categories.length > 0 ? categories[0].id : '' }));
    setStep('review');
  };

  const handlePublish = async () => {
    if (!draft.categoryId) {
      alert("Please select a category.");
      return;
    }

    setPublishing(true);
    try {
      // Upload the swatch to Supabase Storage and store the public URL (not base64).
      let imageUrl: string | null = null;
      if (imagePreview && imagePreview.startsWith('data:')) {
        const up = await uploadProductImage(imagePreview);
        imageUrl = up.url;
      } else if (imagePreview) {
        imageUrl = imagePreview;
      }
      await createProduct(draft, imageUrl);
      alert('Published to Live Collection!');
      router.push('/admin/products');
    } catch (err: any) {
      alert("Failed to publish: " + (err?.message || 'error'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Weave Intelligence</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Gemini 1.5 Pro Fiber Analysis</p>
        </div>
      </div>
      
      <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Image & Upload */}
        <div className="space-y-6">
          <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] h-full flex flex-col relative overflow-hidden">
            
            <AnimatePresence mode="wait">
              {step === 'upload' && (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col"
                >
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-4">Fabric Swatch Upload</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-[var(--charcoal-ink)]/50 p-8 text-center hover:bg-[var(--turmeric)]/10 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[300px]"
                  >
                     {imagePreview ? (
                       <img src={imagePreview} alt="Preview" className="max-h-48 object-cover mb-4 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]" />
                     ) : (
                       <UploadCloud size={40} className="text-[var(--charcoal-ink)] opacity-50 mb-4" />
                     )}
                     <p className="font-sans text-sm opacity-70 font-bold uppercase tracking-widest">{imageFile ? imageFile.name : 'Click to select high-res image'}</p>
                     <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>

                  <div className="mt-6">
                    <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Base Nomenclature (Optional)</label>
                    <input 
                      type="text" 
                      value={baseName}
                      onChange={(e) => setBaseName(e.target.value)}
                      placeholder="e.g. Mithila Silk..." 
                      className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-bold focus:outline-none focus:border-[var(--turmeric)] transition-colors placeholder:font-normal" 
                    />
                  </div>

                  <Button 
                    onClick={handleGenerate}
                    disabled={!imageFile} 
                    className="w-full mt-6 flex items-center justify-center gap-2 bg-[var(--indigo-dye)] text-[var(--unbleached-cotton)] hover:bg-[var(--madder-red)] py-4 text-sm font-bold uppercase tracking-widest"
                  >
                    <Sparkles size={16} /> Initiate Extraction
                  </Button>
                  <button
                    type="button"
                    onClick={handleManualEntry}
                    className="w-full mt-3 text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/70 hover:text-[var(--madder-red)] underline underline-offset-4"
                  >
                    Or enter product details manually
                  </button>
                </motion.div>
              )}

              {step === 'scanning' && (
                <motion.div 
                  key="scanning"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center py-12"
                >
                  <div className="relative w-full max-w-[250px] aspect-square border-4 border-[var(--charcoal-ink)] overflow-hidden shadow-[8px_8px_0_var(--turmeric)] mb-8">
                    <img src={imagePreview!} alt="Scanning" className="w-full h-full object-cover grayscale opacity-50 mix-blend-multiply" />
                    <motion.div 
                      animate={{ top: ['-10%', '110%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 w-full h-2 bg-[var(--turmeric)] shadow-[0_0_15px_var(--turmeric)] opacity-80"
                    />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)] flex items-center gap-2">
                    <RefreshCw className="animate-spin text-[var(--madder-red)]" /> Analyzing Thread Count...
                  </h3>
                  <p className="font-sans text-xs opacity-70 uppercase tracking-widest mt-2">Extracting pigment profile & weave structure</p>
                </motion.div>
              )}

              {step === 'review' && (
                <motion.div 
                  key="review"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-32 h-32 rounded-full border-4 border-[var(--charcoal-ink)] overflow-hidden shadow-[4px_4px_0_var(--turmeric)] mb-6 flex items-center justify-center bg-[var(--unbleached-cotton)]">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Scanned" className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles size={28} className="opacity-40" />
                    )}
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)] flex items-center gap-2 text-green-700">
                    <Check size={24} /> {imagePreview ? 'Extraction Complete' : 'Manual Entry'}
                  </h3>
                  <p className="font-sans text-xs opacity-70 uppercase tracking-widest mt-2 mb-6">{imagePreview ? 'Please review the drafted ledger to the right.' : 'Fill in the ledger to the right, then publish.'}</p>
                  <Button 
                    onClick={() => setStep('upload')}
                    variant="outline"
                    className="text-xs uppercase tracking-widest font-bold border-2 border-[var(--charcoal-ink)]"
                  >
                    Scan Another Fiber
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

        {/* Right Column: Draft Review Form */}
        <div className="space-y-6 h-full">
          {step === 'review' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[8px_8px_0_var(--charcoal-ink)] flex flex-col h-full"
            >
              <h2 className="font-serif text-2xl font-bold border-b-2 border-[var(--charcoal-ink)]/20 pb-4 mb-6">Draft Ledger</h2>
              
              <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Generated Title</label>
                  <input type="text" value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-serif text-xl font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Brand Story & Tactile Description</label>
                  <textarea rows={5} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-[var(--unbleached-cotton)] p-3 font-sans text-sm leading-relaxed focus:outline-none focus:border-[var(--madder-red)] resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Detected Weave</label>
                    <input type="text" value={draft.weaveDensity} onChange={e => setDraft({...draft, weaveDensity: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Category</label>
                    <select value={draft.categoryId} onChange={e => setDraft({...draft, categoryId: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)] cursor-pointer">
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Collections (Optional)</label>
                    <div className="border border-[var(--charcoal-ink)]/20 p-2 max-h-32 overflow-y-auto space-y-1 bg-transparent focus-within:border-[var(--madder-red)]">
                      {collections.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-xs">
                          <input 
                            type="checkbox" 
                            checked={draft.collectionIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDraft({...draft, collectionIds: [...draft.collectionIds, c.id]});
                              } else {
                                setDraft({...draft, collectionIds: draft.collectionIds.filter(id => id !== c.id)});
                              }
                            }}
                          />
                          {c.title}
                        </label>
                      ))}
                      {collections.length === 0 && <span className="opacity-50 text-xs">No collections found</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Weight (GSM)</label>
                    <input type="number" value={draft.gsm} onChange={e => setDraft({...draft, gsm: parseInt(e.target.value) || 0})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Minimum Order Quantity (Meters)</label>
                    <input type="number" min="1" value={draft.minOrderQuantity} onChange={e => setDraft({...draft, minOrderQuantity: parseInt(e.target.value) || 1})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Width</label>
                    <input type="text" value={draft.width} onChange={e => setDraft({...draft, width: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Count (e.g. 40s x 40s)</label>
                    <input type="text" value={draft.count} onChange={e => setDraft({...draft, count: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Construction (e.g. 120 x 80)</label>
                    <input type="text" value={draft.construction} onChange={e => setDraft({...draft, construction: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Stretch</label>
                    <input type="text" value={draft.stretch} onChange={e => setDraft({...draft, stretch: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Print / Pattern</label>
                    <input type="text" value={draft.print} onChange={e => setDraft({...draft, print: e.target.value})} placeholder="e.g. Solid, Hand Block, Digital Print" className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Origin</label>
                    <input type="text" value={draft.origin} onChange={e => setDraft({...draft, origin: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold focus:outline-none focus:border-[var(--madder-red)]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Best Suited For (Comma Separated)</label>
                  <input type="text" value={draft.bestSuitedFor} onChange={e => setDraft({...draft, bestSuitedFor: e.target.value})} className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-2 font-bold text-sm focus:outline-none focus:border-[var(--madder-red)]" />
                </div>

                <div className="grid grid-cols-2 gap-4 items-end pt-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Price per Meter (INR)</label>
                    <div className="flex items-center border-b-2 border-[var(--charcoal-ink)]/20 focus-within:border-[var(--madder-red)]">
                      <span className="font-serif font-bold text-xl mr-1">₹</span>
                      <input type="number" value={draft.pricePerMeter} onChange={e => setDraft({...draft, pricePerMeter: parseInt(e.target.value) || 0})} className="w-full bg-transparent py-2 font-bold text-xl focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-2">Color Variants (Press Enter to Add)</label>
                    <input 
                      type="text" 
                      value={newColor}
                      onChange={e => setNewColor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newColor.trim()) {
                          e.preventDefault();
                          if (!draft.colors.includes(newColor.trim())) {
                            setDraft({...draft, colors: [...draft.colors, newColor.trim()]});
                          }
                          setNewColor('');
                        }
                      }}
                      className="w-full border-b-2 border-[var(--charcoal-ink)]/20 bg-transparent py-1 text-sm focus:outline-none focus:border-[var(--madder-red)] mb-2"
                      placeholder="Add color..."
                    />
                    <div className="flex flex-wrap gap-2">
                      {draft.colors.map((c, i) => (
                        <span key={i} className="bg-[var(--charcoal-ink)] text-white px-2 py-1 text-[10px] uppercase tracking-widest flex items-center gap-1 group">
                          {c}
                          <button type="button" onClick={() => setDraft({...draft, colors: draft.colors.filter(col => col !== c)})} className="hover:text-[var(--madder-red)] opacity-50 group-hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={handlePublish} disabled={publishing} className="w-full mt-6 bg-[var(--madder-red)] text-white hover:bg-[var(--charcoal-ink)] py-6 text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-[4px_4px_0_var(--turmeric)] hover:translate-x-1 hover:-translate-y-1 transition-all">
                {publishing ? 'Publishing…' : <>Publish to Collection <ArrowRight size={18} /></>}
              </Button>
            </motion.div>
          ) : (
            <div className="h-full border-4 border-dashed border-[var(--charcoal-ink)]/10 flex flex-col items-center justify-center text-center p-8 opacity-50">
              <Sparkles size={48} className="mb-4" />
              <h2 className="font-serif text-2xl font-bold">Awaiting Input</h2>
              <p className="font-sans text-xs uppercase tracking-widest mt-2">Upload a fabric image to initiate Gemini 1.5 Pro structural extraction.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
