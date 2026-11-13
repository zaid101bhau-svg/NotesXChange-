import React, { useState } from 'react';
import { Upload, FileText, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadFormWithProgress } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { EducationBoard, StudyNote } from '../types/marketplace';

interface UploadNotePageProps {
  onNavigate: (path: string) => void;
}

const PRESET_COVERS = [
  { label: 'Physics Optics', url: '/src/assets/images/cover_physics_optics_1794512073101.jpg' },
  {
    label: 'Organic Chemistry',
    url: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
  },
  {
    label: 'Mathematics Calculus',
    url: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
  },
  {
    label: 'Biology Genetics',
    url: '/src/assets/images/cover_biology_genetics_1794512074893.jpg',
  },
];

export function UploadNotePage({ onNavigate }: UploadNotePageProps) {
  const { firebaseUser, profile, subjects, openAuthModal } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classLevel, setClassLevel] = useState<number>(profile?.classLevel || 10);
  const [subject, setSubject] = useState(subjects[0]?.name || 'Mathematics');
  const [chapterName, setChapterName] = useState('');
  const [board, setBoard] = useState<EducationBoard>(profile?.board || 'CBSE');
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState('49');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [presetCoverUrl, setPresetCoverUrl] = useState(PRESET_COVERS[2].url);
  const [originalityAttested, setOriginalityAttested] = useState(false);

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedNote, setUploadedNote] = useState<StudyNote | null>(null);

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Sign in to Upload Study Notes
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Share your original Class 6–12 notes with peers across India.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!profile?.onboardingCompleted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Complete Student Onboarding First
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We need your Class, Board, and Seller role selection before you can publish study notes.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/onboarding')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Go to Onboarding
        </button>
      </div>
    );
  }

  if (!profile.roles?.includes('seller')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Enable Seller Role</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your profile is currently set to Buyer/Explorer. Enable the Seller role in your profile
          settings to upload study notes.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/onboarding')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Update Roles
        </button>
      </div>
    );
  }

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only valid PDF files (.pdf) are accepted.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('PDF file size must be under 25 MB.');
      return;
    }
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pdfFile) {
      setError('Please select a PDF study note file.');
      return;
    }
    if (!originalityAttested) {
      setError('Please confirm that your uploaded study notes are original or authorized.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('classLevel', String(classLevel));
      form.append('subject', subject);
      form.append('chapterName', chapterName.trim());
      form.append('board', board);
      form.append('price', isFree ? '0' : String(Math.max(1, Number(price || 0))));
      form.append('originalityAttested', 'true');
      form.append('pdf', pdfFile);
      if (coverFile) {
        form.append('cover', coverFile);
      } else {
        form.append('defaultCoverUrl', presetCoverUrl);
      }

      const res = await uploadFormWithProgress<{ note: StudyNote }>('/notes', form, (pct) => {
        setProgress(pct);
      });
      setUploadedNote(res.note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (uploadedNote) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Study Notes Uploaded Successfully
              </h1>
              <p className="text-sm text-slate-600">
                Status:{' '}
                <span className="font-semibold capitalize text-blue-700">
                  {uploadedNote.status}
                </span>{' '}
                · {uploadedNote.pageCount} pages processed with 2-page sample preview
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            {uploadedNote.status === 'approved'
              ? 'Your study notes are live on the marketplace immediately.'
              : 'Your upload has been submitted to the Admin moderation queue for originality and quality verification.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {uploadedNote.status === 'approved' && (
              <button
                type="button"
                onClick={() => onNavigate(`/notes/${uploadedNote.id}`)}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                View Live Note
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/dashboard?tab=uploaded')}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800"
            >
              Manage My Uploaded Notes
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadedNote(null);
                setTitle('');
                setDescription('');
                setChapterName('');
                setPdfFile(null);
              }}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-600 hover:underline"
            >
              Upload Another Note
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-slate-900">Upload Original Study Notes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Upload clean PDF study guides for Class 6–12. Sample preview pages are generated
        automatically while your full PDF remains safely gated.
      </p>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Note Details</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes Title *</label>
            <input
              type="text"
              required
              minLength={4}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Class 12 Physics – Ray Optics & Wave Optics Complete Handwritten Notes"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Class (6–12) *
              </label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                {[6, 7, 8, 9, 10, 11, 12].map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chapter Name *
              </label>
              <input
                type="text"
                required
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="e.g., Ray Optics and Optical Instruments"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Education Board *
              </label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value as EducationBoard)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State Board">State Board</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              required
              minLength={10}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what topics, derivations, diagrams, or solved board questions are covered in these notes..."
              className="w-full rounded-xl border border-slate-300 p-3.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-slate-900">Pricing</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsFree(true)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                isFree
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700'
              }`}
            >
              Free Notes (₹0)
            </button>
            <button
              type="button"
              onClick={() => setIsFree(false)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                !isFree
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700'
              }`}
            >
              Paid Notes (Set INR Price)
            </button>
          </div>

          {!isFree && (
            <div className="mt-4 max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Price in INR (₹) *
              </label>
              <input
                type="number"
                min="10"
                max="2000"
                required={!isFree}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm tabular-nums"
              />
            </div>
          )}
        </div>

        {/* Files & Cover */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <h2 className="font-display text-lg font-bold text-slate-900">PDF &amp; Cover Image</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Study Notes PDF File (Max 25 MB) *
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center hover:border-blue-400">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="mt-2 text-sm font-semibold text-slate-800">
                {pdfFile ? pdfFile.name : 'Click to select PDF document'}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {pdfFile
                  ? `${(pdfFile.size / 1024).toFixed(0)} KB · Ready to upload`
                  : 'Validated PDF only — first 2 pages auto-extracted for student preview'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfSelect}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Cover Image (Upload custom or pick an editorial subject cover)
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => {
                    setCoverFile(null);
                    setPresetCoverUrl(preset.url);
                  }}
                  className={`overflow-hidden rounded-xl border text-left transition-all ${
                    !coverFile && presetCoverUrl === preset.url
                      ? 'border-blue-600 ring-2 ring-blue-600'
                      : 'border-slate-200'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 truncate">
                    {preset.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                {coverFile ? `Selected: ${coverFile.name}` : 'Upload Custom Cover Image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={originalityAttested}
              onChange={(e) => setOriginalityAttested(e.target.checked)}
              className="mt-0.5"
            />
            <span className="leading-relaxed">
              <strong className="text-slate-900">Originality &amp; Copyright Attestation:</strong> I
              confirm that these study notes are my original work or properly authorized material. I
              understand copyrighted textbooks, pirated PDFs, and plagiarized notes are permanently
              removed.
            </span>
          </label>
        </div>

        {uploading && (
          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
              <span>Uploading &amp; generating sample pages...</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Protected private PDF storage enabled</span>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Submit Study Notes'}
          </button>
        </div>
      </form>
    </div>
  );
}
