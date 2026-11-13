import { fsQuery, fsSetDoc, fsGetDoc } from './firestoreRest.ts';
import { listCuratedCbseNotes, ensureCbseClass6And7Pdfs } from './cbseLibrary.ts';

export const DEFAULT_SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', slug: 'mathematics', description: 'Numbers, Algebra, Geometry, Mensuration, and Problem Solving.', sortOrder: 1 },
  { id: 'science', name: 'Science', slug: 'science', description: 'Integrated NCERT Class 6–10 Physics, Chemistry, and Biology concepts.', sortOrder: 2 },
  { id: 'social-science', name: 'Social Science', slug: 'social-science', description: 'History timelines, Civics, Political Science, and Geography maps.', sortOrder: 3 },
  { id: 'english', name: 'English', slug: 'english', description: 'Literature summaries, Grammar, Comprehension, and Writing Formats.', sortOrder: 4 },
  { id: 'hindi', name: 'Hindi', slug: 'hindi', description: 'Vasant chapters, Vyakaran grammar rules, and Patra/Nibandh formats.', sortOrder: 5 },
  { id: 'sanskrit', name: 'Sanskrit', slug: 'sanskrit', description: 'Ruchira chapters, Shabd-Roop, Dhatu-Roop, Shlokas, and Anuvad.', sortOrder: 6 },
  { id: 'computer-science', name: 'Computer Science', slug: 'computer-science', description: 'Scratch, HTML/CSS, Python, SQL, Flowcharts, and Cyber Safety.', sortOrder: 7 },
  { id: 'physics', name: 'Physics', slug: 'physics', description: 'Mechanics, Optics, Electromagnetism, Thermodynamics, and Modern Physics.', sortOrder: 8 },
  { id: 'chemistry', name: 'Chemistry', slug: 'chemistry', description: 'Physical, Organic, and Inorganic Chemistry mechanisms and equations.', sortOrder: 9 },
  { id: 'biology', name: 'Biology', slug: 'biology', description: 'Cell Biology, Genetics, Human Physiology, Ecology, and Botany.', sortOrder: 10 },
  { id: 'economics', name: 'Economics', slug: 'economics', description: 'Microeconomics, Macroeconomics, and Indian Economic Development.', sortOrder: 11 },
  { id: 'accountancy', name: 'Accountancy', slug: 'accountancy', description: 'Financial Statements, Partnership Accounts, and Cash Flow Analysis.', sortOrder: 12 },
  { id: 'business-studies', name: 'Business Studies', slug: 'business-studies', description: 'Principles of Management, Marketing, and Financial Markets.', sortOrder: 13 },
];

export const DEFAULT_CATEGORIES = [
  { id: 'chapter-notes', name: 'Chapter Notes', description: 'Complete chapter-by-chapter handwritten and typed summaries.' },
  { id: 'formula-sheets', name: 'Formula Sheets', description: 'Quick-revision formula compendiums and theorem sheets.' },
  { id: 'mind-maps', name: 'Mind Maps', description: 'Visual concept maps and flowchart summaries.' },
  { id: 'solved-question-banks', name: 'Solved Question Banks', description: 'Worked board exam solutions and step-by-step derivations.' },
  { id: 'practical-lab-guides', name: 'Practical Lab Guides', description: 'Lab experiment records, viva questions, and observation guides.' },
];

export async function seedTaxonomyAsAdmin(adminToken: string, adminUid?: string) {
  try {
    const existingSubjects = await fsQuery<{ id?: string }>('subjects', { token: adminToken });
    const existingIds = new Set(existingSubjects.map((s) => s.id));
    const missingSubjects = DEFAULT_SUBJECTS.filter((s) => !existingIds.has(s.id));
    if (missingSubjects.length > 0) {
      await Promise.all(missingSubjects.map((s) => fsSetDoc('subjects', s.id, s, adminToken)));
    }

    const existingCats = await fsQuery('categories', { limit: 1, token: adminToken });
    if (existingCats.length === 0) {
      const now = new Date().toISOString();
      await Promise.all(
        DEFAULT_CATEGORIES.map((c) => fsSetDoc('categories', c.id, { ...c, createdAt: now }, adminToken))
      );
    }

    const settingsDoc = await fsGetDoc('platform_settings', 'global', adminToken);
    if (!settingsDoc.exists) {
      const envRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 15);
      await fsSetDoc(
        'platform_settings',
        'global',
        { commissionRatePercent: Number.isFinite(envRate) ? envRate : 15, updatedAt: new Date().toISOString() },
        adminToken
      );
    }

    if (adminUid) {
      await ensureCbseClass6And7Pdfs();
      const curated = listCuratedCbseNotes();
      for (const note of curated) {
        const snap = await fsGetDoc('notes', note.id, adminToken).catch(() => ({ exists: false }));
        if (!snap.exists) {
          await fsSetDoc(
            'notes',
            note.id,
            {
              ...note,
              sellerId: adminUid,
            },
            adminToken
          ).catch((err) => console.error(`Seed CBSE note ${note.id} skipped:`, err));
        }
      }
    }
  } catch (error) {
    console.error('Admin taxonomy seed warning:', error);
  }
}
