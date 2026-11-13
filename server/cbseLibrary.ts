import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ensureStorageDirs, PRIVATE_PDF_DIR, PREVIEW_PDF_DIR } from './storage.ts';
import type { StudyNote } from '../src/types/marketplace.ts';

export const CBSE_CURATOR_UID = 'cbse_ncert_library';

export const CBSE_CURATOR_PROFILE = {
  uid: CBSE_CURATOR_UID,
  fullName: 'CBSE NCERT Academic Desk',
  username: 'cbse_ncert_notes',
  classLevel: 7,
  schoolName: 'NOTE XCHANGE Open CBSE Library',
  board: 'CBSE' as const,
  avatarUrl: '',
  bio: 'Official free CBSE NCERT Class 6 & Class 7 study notes covering Mathematics, Science, Social Science, English, Hindi, Sanskrit, and Computer Science.',
  roles: ['seller', 'explorer'],
  followersCount: 0,
  followingCount: 0,
  uploadedNotesCount: 14,
  totalSalesCount: 0,
  averageRating: 4.9,
  contributionPoints: 350,
  badges: ['Rising Contributor', 'Top Contributor'],
  onboardingCompleted: true,
  createdAt: '2026-01-10T08:00:00.000Z',
  updatedAt: '2026-01-10T08:00:00.000Z',
};

interface CuratedCbseSpec {
  id: string;
  classLevel: 6 | 7;
  subject: string;
  chapterName: string;
  title: string;
  description: string;
  coverUrl: string;
  createdAt: string;
  syllabusUnits: string[];
  coreConcepts: { heading: string; detail: string }[];
  formulasAndRules: string[];
  solvedQuestions: { q: string; a: string }[];
  examChecklist: string[];
}

const CURATED_CBSE_SPECS: CuratedCbseSpec[] = [
  // ==================== CLASS 6 CBSE ALL SUBJECTS ====================
  {
    id: 'cbse_c6_mathematics',
    classLevel: 6,
    subject: 'Mathematics',
    chapterName: 'Complete NCERT Term 1 & 2 (Ch 1-12)',
    title: 'Class 6 CBSE Mathematics Complete NCERT Notes & Formula Pack',
    description:
      'Free comprehensive CBSE Class 6 NCERT Mathematics revision notes covering Knowing Our Numbers, Whole Numbers, Playing with Numbers, Basic Geometrical Ideas, Integers, Fractions, Decimals, Data Handling, Mensuration, Algebra, and Ratio & Proportion with solved exercises.',
    coverUrl: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
    createdAt: '2026-02-01T09:00:00.000Z',
    syllabusUnits: [
      'Ch 1-3: Knowing Our Numbers, Whole Numbers, Playing with Numbers (HCF & LCM)',
      'Ch 4-6: Basic Geometrical Ideas, Elementary Shapes, Integers',
      'Ch 7-8: Fractions & Decimals (Conversion, Number Line, Operations)',
      'Ch 9-12: Data Handling, Mensuration (Perimeter & Area), Algebra, Ratio & Proportion',
    ],
    coreConcepts: [
      {
        heading: 'Indian vs International System of Numeration',
        detail:
          'Indian system groups digits as 3-2-2 (Lakhs, Crores). International system groups in threes (Thousands, Millions). 1 Million = 10 Lakhs; 1 Crore = 10 Million.',
      },
      {
        heading: 'Divisibility Rules, HCF & LCM',
        detail:
          'HCF is the greatest common factor dividing two numbers exactly. LCM is the smallest common multiple. Product of two numbers = HCF x LCM.',
      },
      {
        heading: 'Integers & Number Line Ordering',
        detail:
          'Numbers greater than 0 are positive; less than 0 are negative. Moving right increases value, so -2 > -7 even though 7 > 2.',
      },
      {
        heading: 'Introduction to Algebra & Ratio',
        detail:
          'Variables (like x, n) represent unknown quantities. Ratio a:b is the comparison of two like quantities in the same unit; Proportion means a:b :: c:d (a*d = b*c).',
      },
    ],
    formulasAndRules: [
      'Perimeter of Rectangle = 2 x (Length + Breadth) | Area of Rectangle = Length x Breadth',
      'Perimeter of Square = 4 x Side | Area of Square = Side x Side',
      'Perimeter of Equilateral Triangle = 3 x Side | Regular Hexagon = 6 x Side',
      'Divisibility by 3: Sum of digits divisible by 3 | By 4: Last 2 digits divisible by 4',
      'Divisibility by 6: Divisible by both 2 and 3 | By 11: Difference of alternating digit sums is 0 or 11x',
      'Fractions: Like fractions have identical denominators; Equivalent fractions multiply/divide numerator & denominator by same non-zero number.',
      'Commutative Property: a + b = b + a and a x b = b x a (Holds for + and x, NOT for - or /).',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Find the HCF and LCM of 24 and 36.',
        a: 'Prime factorization: 24 = 2^3 x 3, 36 = 2^2 x 3^2. HCF = 2^2 x 3 = 12. LCM = 2^3 x 3^2 = 72.',
      },
      {
        q: 'Q2. A rectangular park is 45 m long and 30 m wide. Find its perimeter and area.',
        a: 'Perimeter = 2 x (45 + 30) = 150 m. Area = 45 x 30 = 1350 sq. m.',
      },
      {
        q: 'Q3. Divide Rs 60 in the ratio 1:2 between Anu and Raj.',
        a: 'Total parts = 1 + 2 = 3. Anu gets (1/3) x 60 = Rs 20. Raj gets (2/3) x 60 = Rs 40.',
      },
    ],
    examChecklist: [
      'Always convert units (cm to m or g to kg) before calculating ratios or mensuration.',
      'Check signs carefully when subtracting negative integers: a - (-b) = a + b.',
      'Show prime factorization steps clearly for full marks in HCF/LCM problems.',
    ],
  },
  {
    id: 'cbse_c6_science',
    classLevel: 6,
    subject: 'Science',
    chapterName: 'Complete NCERT Science (Ch 1-11)',
    title: 'Class 6 CBSE Science Complete NCERT Notes, Diagrams & Activities',
    description:
      'Free CBSE Class 6 Science study pack aligned to latest NCERT chapters: Components of Food, Sorting Materials, Separation of Substances, Getting to Know Plants, Body Movements, Living Organisms, Motion & Measurement, Light, Electricity & Circuits, Magnets, and Air Around Us.',
    coverUrl: '/src/assets/images/cover_biology_genetics_1794512074893.jpg',
    createdAt: '2026-02-01T09:05:00.000Z',
    syllabusUnits: [
      'Biology: Components of Food, Getting to Know Plants, Body Movements, Living Organisms & Habitats',
      'Chemistry: Sorting Materials into Groups, Separation of Substances, Air Around Us',
      'Physics: Motion & Measurement of Distances, Light Shadows & Reflections, Electricity & Circuits, Fun with Magnets',
    ],
    coreConcepts: [
      {
        heading: 'Nutrients & Deficiency Diseases',
        detail:
          'Carbohydrates and fats give energy; proteins help growth and repair; vitamins and minerals protect against diseases (Vit A: night blindness, Vit C: scurvy, Vit D: rickets, Iron: anaemia, Iodine: goitre).',
      },
      {
        heading: 'Separation Methods for Mixtures',
        detail:
          'Handpicking (large impurities), Winnowing (lighter husk from grain), Sieving (different particle sizes), Sedimentation & Decantation (heavy insoluble solids), Filtration, Evaporation & Condensation.',
      },
      {
        heading: 'Plants & Skeletal Joints',
        detail:
          'Taproot (dicots with reticulate venation) vs Fibrous root (monocots with parallel venation). Joints: Ball & socket (shoulder), Hinge (elbow/knee), Pivot (neck), Fixed (skull).',
      },
      {
        heading: 'Light, Electricity & Magnets',
        detail:
          'Light travels in straight lines; opaque objects form shadows. Electric circuit requires a closed path from +ve to -ve terminal. Like magnetic poles repel; unlike poles attract.',
      },
    ],
    formulasAndRules: [
      'SI Unit of Length = Metre (m). 1 km = 1000 m | 1 m = 100 cm | 1 cm = 10 mm.',
      'Types of Motion: Rectilinear (straight line), Circular (fixed distance from centre), Periodic (repeats after fixed time).',
      'Food Tests: Starch turns blue-black with Iodine; Protein turns violet with Copper Sulphate + Caustic Soda; Fat leaves translucent oily patch on paper.',
      'Conductors allow electric current (copper, aluminium, graphite); Insulators block current (rubber, plastic, wood).',
      'Air Composition: ~78% Nitrogen, ~21% Oxygen, ~1% Argon/CO2/Water Vapour.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Why is a pinhole camera image always inverted?',
        a: 'Because light travels in straight lines; rays from the top of the object travel straight through the pinhole to the bottom of the screen and vice versa.',
      },
      {
        q: 'Q2. How will you separate a mixture of sand, salt, and water?',
        a: 'Filter the mixture to separate insoluble sand as residue, then evaporate the salt-water filtrate to recover dry salt.',
      },
      {
        q: 'Q3. What is the difference between transparent, translucent, and opaque materials?',
        a: 'Transparent allows almost all light (glass); translucent allows partial light (butter paper); opaque blocks all light (wood/metal).',
      },
    ],
    examChecklist: [
      'Memorize all vitamin deficiency tables and food nutrient tests (starch/protein/fat).',
      'Practice neat labelled diagrams of leaf venation, dry cell, and closed electric circuit.',
      'Review habitat adaptations for desert (camel/cactus), aquatic, and mountain organisms.',
    ],
  },
  {
    id: 'cbse_c6_social_science',
    classLevel: 6,
    subject: 'Social Science',
    chapterName: 'History, Geography & Civics Complete Pack',
    title: 'Class 6 CBSE Social Science Complete Notes (History, Geography, Civics)',
    description:
      'Free NCERT Class 6 Social Science study guide uniting Our Pasts I (History), The Earth Our Habitat (Geography), and Social & Political Life I (Civics) with timelines, key terms, latitudes/longitudes, and Panchayati Raj notes.',
    coverUrl: '/src/assets/images/cover_physics_optics_1794512073101.jpg',
    createdAt: '2026-02-01T09:10:00.000Z',
    syllabusUnits: [
      'History (Our Pasts I): Earliest Societies, Harappan Cities, Vedic Age, Ashoka & Mauryan Empire, Gupta Age',
      'Geography (The Earth Our Habitat): Solar System, Globe (Latitudes & Longitudes), Motions of Earth, Maps, Domains & India',
      'Civics (Social & Political Life I): Diversity, Prejudice & Discrimination, Government, Panchayati Raj, Rural & Urban Administration',
    ],
    coreConcepts: [
      {
        heading: 'Indus Valley (Harappan) Civilization',
        detail:
          'Planned grid cities divided into Citadel (west) and Lower Town (east), Great Bath at Mohenjodaro, covered drainage system, granaries, and bronze tools (~4700 years ago).',
      },
      {
        heading: 'Ashoka & Dhamma Policy',
        detail:
          'After the Kalinga War, Emperor Ashoka renounced conquest by war and promoted Dhamma (non-violence, respect for elders, religious tolerance) inscribed on Prakrit Brahmi pillars.',
      },
      {
        heading: 'Latitudes, Longitudes & Time Zones',
        detail:
          'Equator (0 deg latitude) divides N/S hemispheres. Prime Meridian (0 deg longitude, Greenwich) is reference for time; Earth rotates 360 deg in 24 hrs (15 deg/hour = 4 min per degree). IST is 82.5 deg E (+5h 30m).',
      },
      {
        heading: 'Panchayati Raj (3-Tier Local Governance)',
        detail:
          'Gram Panchayat at village level (headed by Sarpanch, overseen by Gram Sabha), Panchayat Samiti at block level, and Zila Parishad at district level.',
      },
    ],
    formulasAndRules: [
      'Rotation (24 hours) causes Day & Night | Revolution (365.25 days, tilted axis 23.5 deg) causes Seasons.',
      'Important Parallels: Tropic of Cancer (23.5 N), Tropic of Capricorn (23.5 S), Arctic Circle (66.5 N), Antarctic Circle (66.5 S).',
      '4 Major Domains of Earth: Lithosphere (land), Hydrosphere (water), Atmosphere (air), Biosphere (life zone).',
      'Map 3 Components: Distance (Scale), Direction (Cardinal N/S/E/W), Symbols (Conventional signs).',
      'Local Self-Government: Municipal Corporation (big cities) vs Municipal Council (smaller towns); Patwari measures rural land.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. What is the difference between Gram Sabha and Gram Panchayat?',
        a: 'Gram Sabha includes all adults (18+) registered as voters in the village. Gram Panchayat is the smaller elected executive committee (Ward Panchs & Sarpanch) accountable to the Gram Sabha.',
      },
      {
        q: 'Q2. Why does India have Standard Time at 82.5 deg East longitude?',
        a: 'To avoid confusion across ~30 degrees of longitude from Gujarat to Arunachal Pradesh (~2-hour local time difference), 82.5 deg E passing near Mirzapur (UP) serves as uniform Indian Standard Time (IST).',
      },
    ],
    examChecklist: [
      'Revise the 3 Heat Zones of Earth (Torrid, Temperate, Frigid) with degree boundaries.',
      'Distinguish between Palaeolithic, Mesolithic, and Neolithic archaeological tools.',
      'Remember duties of Tehsildar, Patwari, and SHO in District & Police administration.',
    ],
  },
  {
    id: 'cbse_c6_english',
    classLevel: 6,
    subject: 'English',
    chapterName: 'Honeysuckle, A Pact with the Sun & Grammar',
    title: 'Class 6 CBSE English Literature Summaries, Grammar & Writing Guide',
    description:
      'Free CBSE Class 6 English revision notes covering Honeysuckle prose & poems, A Pact with the Sun supplementary stories, plus complete English Grammar (Nouns, Pronouns, Tenses, Articles, Prepositions) and Notice/Letter Writing formats.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-01T09:15:00.000Z',
    syllabusUnits: [
      'Honeysuckle Prose & Poems: Who Did Patrick\'s Homework, How the Dog Found Himself a Master, Taro\'s Reward, Kalpana Chawla, A Different Kind of School',
      'A Pact with the Sun: A Tale of Two Birds, The Friendly Mongoose, Tansen, The Monkey and the Crocodile',
      'Grammar & Composition: Parts of Speech, Tenses, Articles, Subject-Verb Agreement, Formal/Informal Letters, Notice & Diary Writing',
    ],
    coreConcepts: [
      {
        heading: 'Literature Core Themes & Morals',
        detail:
          'Hard work & self-reliance ("Who Did Patrick\'s Homework"), filial devotion ("Taro\'s Reward"), empathy ("A Different Kind of School"), courage & scientific ambition ("Kalpana Chawla"), and calm presence of mind ("The Monkey and the Crocodile").',
      },
      {
        heading: 'Tenses Quick Reference',
        detail:
          'Simple Present (habitual facts: V1/V1+s), Present Continuous (is/am/are + V-ing), Simple Past (completed actions: V2), Past Continuous (was/were + V-ing), Future (will/shall + V1).',
      },
      {
        heading: 'Notice Writing Format (50 Words)',
        detail:
          'Must be inside a rectangular box: Name of Institution -> NOTICE -> Date -> Suitable Heading -> Body (What, When, Where, Whom to contact) -> Signature, Name & Designation.',
      },
    ],
    formulasAndRules: [
      'Articles: Use "a" before consonant sounds (a university), "an" before vowel sounds (an hour, an honest man), "the" for specific/unique nouns.',
      'Subject-Verb Agreement: Singular subject takes singular verb ("Each of the boys is ready"); plural subject takes plural verb.',
      'Poetic Devices: Simile (comparison using like/as), Metaphor (direct comparison), Alliteration (repeated initial consonant sound), Personification.',
      'Formal Letter Structure: Sender Address -> Date -> Receiver Designation & Address -> Subject -> Salutation -> Body (3 short paragraphs) -> Subscription (Yours sincerely).',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Fill with suitable articles: "__ honest student returned __ lost purse to __ principal."',
        a: '"An honest student returned the lost purse to the principal." (honest starts with vowel sound /o/).',
      },
      {
        q: 'Q2. What lesson does "Tansen" teach us?',
        a: 'Presence of mind and mastery over art can overcome jealousy; Tansen saved himself from Raga Deepak\'s heat by training Saraswati and Rupvati to sing Raga Megh.',
      },
    ],
    examChecklist: [
      'Always enclose Notice Writing inside a neat box and stay within the 50-word limit.',
      'Learn synonyms, antonyms, and character sketches for long-answer literature questions.',
      'Check tense consistency across paragraphs in story/diary writing.',
    ],
  },
  {
    id: 'cbse_c6_hindi',
    classLevel: 6,
    subject: 'Hindi',
    chapterName: 'Vasant Bhag 1 & Hindi Vyakaran Complete',
    title: 'Class 6 CBSE Hindi (Vasant Bhag 1 + Vyakaran) Chapter Notes & Formats',
    description:
      'Free CBSE Class 6 Hindi NCERT revision notes covering Vasant Bhag 1 prose & poems, Bal Ram Katha highlights, essential Hindi Vyakaran (Sangya, Sarvanam, Visheshan, Kriya, Sandhi, Vilom, Paryayvachi), and Patra/Anuchhed Lekhan.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-01T09:20:00.000Z',
    syllabusUnits: [
      'Vasant Bhag 1: Wah Chidiya Jo, Bachpan, Nadaan Dost, Chand Se Thodi Si Gappe, Sathi Haath Badhana, Jhansi Ki Rani',
      'Bal Ram Katha: Ayodhya, Janakpuri, Van Gaman, Lanka Vijay key events & character traits',
      'Hindi Vyakaran: Bhasha & Varn Vichar, Sangya, Sarvanam, Visheshan, Kriya, Kaal, Karak, Muhavare, Patra & Anuchhed Lekhan',
    ],
    coreConcepts: [
      {
        heading: 'Vasant Poetry & Prose Key Takeaways',
        detail:
          '"Wah Chidiya Jo" (Kedarnath Agarwal) celebrates contentment and courage. "Sathi Haath Badhana" (Sahir Ludhianvi) highlights unity and collective labour. "Nadaan Dost" (Premchand) teaches kindness with understanding toward animals.',
      },
      {
        heading: 'Sangya, Sarvanam & Visheshan Types',
        detail:
          'Sangya (3 types): Vyakti-vachak, Jati-vachak, Bhav-vachak. Sarvanam (6 types): Purush, Nishchay, Anishchay, Sambandh, Prashn, Nij-vachak. Visheshan: Gun, Sankhya, Pariman, Sarvanamik.',
      },
      {
        heading: 'Patra Lekhan (Aupcharik & Anaupcharik)',
        detail:
          'Formal letters (Pradhanacharya ko avkash patra / shikayat patra) include Vishay (Subject) and "Aapka agyakari shishya". Informal letters to family use "Sadar Pranam / Saprem Namaste".',
      },
    ],
    formulasAndRules: [
      'Karak (8 Vibhaktiyan): Karta (ne), Karm (ko), Karan (se/ke dwara), Sampradan (ko/ke liye), Apadan (se alag hone par), Sambandh (ka/ke/ki), Adhikaran (me/par), Sambodhan (he/are).',
      'Sandhi Basics: Vidya + Alay = Vidyalaya (Dirgh Swar Sandhi); Surya + Uday = Suryodaya (Gun Swar Sandhi).',
      'Kaal (Tense): Bhootkaal (past), Vartamankaal (present), Bhavishyatkaal (future).',
      'Vachan & Ling Rules: Always check verb gender/number agreement with subject/object.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. "Sathi Haath Badhana" kavita ka mukhya sandesh kya hai?',
        a: 'Ekta aur miljul kar mehnat karne se bade se bada kathin karya bhi saral ho jata hai; ek akela thak sakta hai par sab milkar bojh baant lete hain.',
      },
      {
        q: 'Q2. Identify Sangya bhed: "Bachpan mein sabhi ko khelna pasand hota hai."',
        a: '"Bachpan" is Bhav-vachak Sangya (abstract noun representing childhood state).',
      },
    ],
    examChecklist: [
      'Revise poet and author names for all Vasant chapters for 1-mark MCQ/extract questions.',
      'Practice 20 common Vilom, Paryayvachi, and Anek Shabdon ke liye Ek Shabd.',
      'Keep Anuchhed Lekhan concise (80-100 words) in a single well-structured paragraph.',
    ],
  },
  {
    id: 'cbse_c6_sanskrit',
    classLevel: 6,
    subject: 'Sanskrit',
    chapterName: 'Ruchira Bhag 1 & Basic Vyakaran',
    title: 'Class 6 CBSE Sanskrit (Ruchira Bhag 1) Shabd-Roop, Dhatu-Roop & Notes',
    description:
      'Free CBSE Class 6 NCERT Sanskrit study notes covering Ruchira Bhag 1 chapter translations, Shabd-Roop tables (Balak, Balika, Phal, Kim), Dhatu-Roop (Path, Gam, Bhav in Lat & Lrit Lakar), Karak-Vibhakti rules, and counting 1-50.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-01T09:25:00.000Z',
    syllabusUnits: [
      'Ruchira Bhag 1 Chapters: Shabd Parichay (I, II, III), Vidyalayah, Vrikshah, Samudratatah, Sukti-Stabakah, Krida-Spardha',
      'Shabd-Roop Tables: Akarant Pulling (Balak), Akarant Striling (Lata), Akarant Napunsakling (Phal)',
      'Dhatu-Roop & Sankhya: Path/Khad/Gam/Drish in Lat (Present) & Lrit (Future) Lakar; Sanskrit Numbers 1-50',
    ],
    coreConcepts: [
      {
        heading: 'Three Lingas & Three Vachanas in Sanskrit',
        detail:
          'Lingas: Pulling (Masculine - e.g., Chashakah), Striling (Feminine - e.g., Dola), Napunsakling (Neuter - e.g., Phalam). Vachanas: Ekavachanam (1), Dvivachanam (2), Bahuvachanam (3 or more).',
      },
      {
        heading: 'Purush & Verb Agreement (Lat Lakar)',
        detail:
          'Pratham Purush (He/She/They): pathati, pathatah, pathanti. Madhyam Purush (Tvam/Yuvam/Yuyam): pathasi, pathathah, pathatha. Uttam Purush (Aham/Avam/Vayam): pathami, pathavah, pathamah.',
      },
      {
        heading: 'Avyaya (Indeclinable Words)',
        detail:
          'Words that never change across gender, number, or case: Yatra (where), Tatra (there), Adya (today), Shvah (tomorrow), Hyah (yesterday), Sah (with), Vina (without), Ch (and).',
      },
    ],
    formulasAndRules: [
      'Akarant Pulling Prathama: Balakah (1), Balakau (2), Balakah (many) | Dvitiya: Balakam, Balakau, Balakan.',
      'Akarant Striling Prathama: Balika (1), Balike (2), Balikah (many).',
      'Akarant Napunsakling Prathama/Dvitiya: Phalam (1), Phale (2), Phalani (many).',
      'Aham (I) always takes -mi ending | Tvam (You) always takes -si ending | Sah/Sa (He/She) takes -ti ending.',
      'Upapada Vibhakti: "Sah" (with) requires Tritiya Vibhakti (e.g., Ramena sah); "Namah" requires Chaturthi Vibhakti (e.g., Gurave namah).',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Translate into Sanskrit: "Two boys read the book."',
        a: '"Balakau pustakam pathatah." (Dvivachanam subject Balakau matches Dvivachanam verb pathatah).',
      },
      {
        q: 'Q2. Fill the correct verb: "Vayam vidyalayam ______." (gam - Lat Lakar)',
        a: '"Vayam vidyalayam gachchamah." (Vayam = Uttam Purush Bahuvachanam).',
      },
    ],
    examChecklist: [
      'Never forget Visarga (:) and Halant (m) marks in Shabd-Roop and Dhatu-Roop tables.',
      'Practice picture-description (Chitra-Varnan) using simple 3-word Sanskrit sentences.',
      'Memorize Avyaya meanings for quick fill-in-the-blank exam marks.',
    ],
  },
  {
    id: 'cbse_c6_computer_science',
    classLevel: 6,
    subject: 'Computer Science',
    chapterName: 'Coding, Scratch, HTML & Office Basics',
    title: 'Class 6 CBSE Computer Science Complete Study Notes & Lab Guide',
    description:
      'Free CBSE Class 6 Computer Science / Skill Module notes covering Computer Categories, MS Word & PowerPoint, MS Excel Formulas, Algorithms & Flowcharts, Scratch Block Programming, HTML Introduction, and Internet Cyber Safety.',
    coverUrl: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
    createdAt: '2026-02-01T09:30:00.000Z',
    syllabusUnits: [
      'Unit 1: Computer Languages & Generations (Machine, Assembly, High-Level, Translators)',
      'Unit 2: MS PowerPoint Animations, Transitions & MS Excel Formulas (SUM, AVERAGE, MAX, MIN)',
      'Unit 3: Algorithms, Flowcharts & Scratch Coding (Events, Motion, Loops, Sensing)',
      'Unit 4: HTML Tags Basics & Internet Safety (Netiquette, Strong Passwords)',
    ],
    coreConcepts: [
      {
        heading: 'Language Translators: Compiler vs Interpreter vs Assembler',
        detail:
          'Assembler converts assembly code to machine code (0s and 1s). Compiler translates an entire high-level program at once; Interpreter translates line-by-line during execution.',
      },
      {
        heading: 'Flowchart Standard Symbols',
        detail:
          'Oval = Start/Stop (Terminal); Parallelogram = Input/Output; Rectangle = Processing/Calculation; Diamond = Decision/Condition (Yes/No); Arrows = Flow lines.',
      },
      {
        heading: 'Scratch Block Coding Logic',
        detail:
          'Sprites perform actions on the Stage using Motion (move, turn), Looks (say, switch costume), Control (repeat, forever, if-then), and Events (when green flag clicked).',
      },
    ],
    formulasAndRules: [
      'Every MS Excel formula MUST start with an equal sign (=), e.g., =SUM(A1:A5) or =AVERAGE(B1:B10).',
      'HTML Structure: <html><head><title>Page</title></head><body><h1>Heading</h1><p>Text</p></body></html>.',
      'Keyboard Shortcuts: Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+Z (Undo), F5 (Start Slide Show).',
      'Cyber Safety Rule: Never share OTPs, passwords, or personal home/school addresses with unknown users online.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Write an Excel formula to find total marks from cells C2 through C6.',
        a: '=SUM(C2:C6)',
      },
      {
        q: 'Q2. Which flowchart symbol checks if marks >= 33 (Pass/Fail)?',
        a: 'Diamond (Decision box) with two outgoing branches labelled Yes and No.',
      },
    ],
    examChecklist: [
      'Practice drawing neat flowcharts for swapping two numbers or finding the larger of two values.',
      'Distinguish container HTML tags (<p>...</p>) from empty tags (<br>, <hr>).',
      'Revise Excel cell addressing (e.g., B4 = Column B, Row 4) and basic built-in functions.',
    ],
  },

  // ==================== CLASS 7 CBSE ALL SUBJECTS ====================
  {
    id: 'cbse_c7_mathematics',
    classLevel: 7,
    subject: 'Mathematics',
    chapterName: 'Complete NCERT Formula Sheet & Solved Notes',
    title: 'Class 7 CBSE Mathematics Complete NCERT Notes & Solved Examples',
    description:
      'Free CBSE Class 7 NCERT Mathematics master notes covering Integers, Fractions & Decimals, Data Handling, Simple Equations, Lines & Angles, The Triangle & Its Properties, Comparing Quantities, Rational Numbers, Perimeter & Area, Algebraic Expressions, and Exponents & Powers.',
    coverUrl: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
    createdAt: '2026-02-02T09:00:00.000Z',
    syllabusUnits: [
      'Ch 1-4: Integers, Fractions & Decimals, Data Handling (Mean/Median/Mode), Simple Equations',
      'Ch 5-6: Lines & Angles (Transversal, Alternate/Corresponding Angles), Triangle & Pythagoras Property',
      'Ch 7-8: Comparing Quantities (Percentage, Profit/Loss, Simple Interest), Rational Numbers',
      'Ch 9-13: Perimeter & Area (Circle, Parallelogram, Triangle), Algebraic Expressions, Exponents & Powers, Symmetry',
    ],
    coreConcepts: [
      {
        heading: 'Transversal & Parallel Lines Properties',
        detail:
          'When a transversal cuts two parallel lines: Corresponding angles are equal, Alternate Interior angles are equal, and Interior angles on the same side of the transversal sum to 180 deg.',
      },
      {
        heading: 'Triangle Angle Sum & Pythagoras Theorem',
        detail:
          'Sum of interior angles = 180 deg. Exterior angle = sum of two opposite interior angles. In a right triangle, Hypotenuse^2 = Base^2 + Perpendicular^2.',
      },
      {
        heading: 'Profit, Loss & Simple Interest',
        detail:
          'Profit% = (Profit / CP) x 100 | Loss% = (Loss / CP) x 100. Simple Interest (SI) = (P x R x T) / 100; Amount = P + SI.',
      },
      {
        heading: 'Laws of Exponents',
        detail:
          'Powers simplify large astronomical/scientific numbers into standard form (e.g., 3.45 x 10^8) and combine cleanly when bases match.',
      },
    ],
    formulasAndRules: [
      'Exponent Laws: a^m x a^n = a^(m+n) | a^m / a^n = a^(m-n) | (a^m)^n = a^(mn) | a^0 = 1 (a != 0).',
      'Area of Parallelogram = Base x Height | Area of Triangle = (1/2) x Base x Height.',
      'Circle: Circumference = 2 x pi x r = pi x d | Area = pi x r^2 (take pi = 22/7 or 3.14).',
      'Statistics: Mean = Sum of observations / Number of observations; Mode = Most frequent value; Median = Middle ordered value.',
      'Integer Multiplication: (+)x(+) = +, (-)x(-) = +, (+)x(-) = -.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Solve the simple equation: 3(n - 5) = 21.',
        a: 'Divide both sides by 3: n - 5 = 7. Add 5 to both sides: n = 12.',
      },
      {
        q: 'Q2. Find the Simple Interest and Amount on Rs 5000 at 8% p.a. for 3 years.',
        a: 'SI = (5000 x 8 x 3) / 100 = Rs 1200. Amount = 5000 + 1200 = Rs 6200.',
      },
      {
        q: 'Q3. Simplify using laws of exponents: (2^5 x 2^3) / 2^6.',
        a: 'Numerator = 2^(5+3) = 2^8. Dividing: 2^(8-6) = 2^2 = 4.',
      },
    ],
    examChecklist: [
      'Profit% and Loss% are ALWAYS calculated on Cost Price (CP), never Selling Price unless stated.',
      'Verify interior angle criteria before applying Alternate/Corresponding angle equality.',
      'For Median, ALWAYS sort data in ascending order before picking the middle term.',
    ],
  },
  {
    id: 'cbse_c7_science',
    classLevel: 7,
    subject: 'Science',
    chapterName: 'Complete NCERT Science (Ch 1-13)',
    title: 'Class 7 CBSE Science Complete NCERT Notes, Equations & Diagrams',
    description:
      'Free CBSE Class 7 Science revision pack aligned to NCERT: Nutrition in Plants & Animals, Heat, Acids Bases & Salts, Physical & Chemical Changes, Respiration, Transportation, Reproduction in Plants, Motion & Time, Electric Current, Light, and Forests.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-02T09:05:00.000Z',
    syllabusUnits: [
      'Biology: Nutrition in Plants & Animals, Respiration in Organisms, Transportation in Animals & Plants, Reproduction in Plants, Forests',
      'Chemistry: Heat & Transfer, Acids Bases & Salts (Indicators), Physical & Chemical Changes, Wastewater Story',
      'Physics: Motion & Time (Speed-Distance-Time Graphs), Electric Current & Effects (Fuse, Electromagnet), Light (Lenses & Mirrors)',
    ],
    coreConcepts: [
      {
        heading: 'Photosynthesis & Digestive Tract',
        detail:
          'Autotrophs synthesize glucose + O2 from CO2 + H2O using sunlight & chlorophyll. In humans, digestion starts in buccal cavity (salivary amylase breaks starch) -> stomach (HCl, pepsin) -> small intestine (villi absorption).',
      },
      {
        heading: 'Acids, Bases, Indicators & Neutralisation',
        detail:
          'Acids taste sour and turn blue litmus RED. Bases feel soapy and turn red litmus BLUE. Phenolphthalein turns pink in base, remains colourless in acid. Acid + Base -> Salt + Water + Heat.',
      },
      {
        heading: 'Heating & Magnetic Effects of Electric Current',
        detail:
          'Current through a wire generates heat (nichrome heater coil, safety fuse melts if excess current flows) and creates a magnetic field (used in electromagnets and electric bells).',
      },
      {
        heading: 'Spherical Mirrors & Lenses',
        detail:
          'Concave mirror forms real/inverted or magnified virtual image (dentists, headlights). Convex mirror always forms virtual, erect, diminished image (rear-view mirrors). Convex lens converges light; concave lens diverges.',
      },
    ],
    formulasAndRules: [
      'Speed = Total Distance Covered / Total Time Taken (SI Unit: m/s; also km/h; convert km/h to m/s by x 5/18).',
      'Temperature Conversion: C / 5 = (F - 32) / 9. Clinical thermometer range: 35 C to 42 C (normal = 37 C).',
      'Heat Transfer: Conduction (solids), Convection (liquids/gases — sea & land breeze), Radiation (no medium needed).',
      'Respiration Equation: Glucose + Oxygen -> CO2 + Water + Energy (Aerobic); Anaerobic in yeast produces Alcohol + CO2.',
      'Chemical Change Indicators: New substance formed, colour change, gas evolution, heat/light, irreversible (rusting, burning).',
    ],
    solvedQuestions: [
      {
        q: 'Q1. A school bus travels 54 km in 1.5 hours. Find its speed in km/h and m/s.',
        a: 'Speed = 54 / 1.5 = 36 km/h. In m/s: 36 x (5/18) = 10 m/s.',
      },
      {
        q: 'Q2. How are rusting of iron and galvanisation related?',
        a: 'Rusting requires both oxygen and water (4Fe + 3O2 + xH2O -> 2Fe2O3.xH2O). Galvanisation coats iron with a thin layer of zinc to prevent contact with air/moisture.',
      },
      {
        q: 'Q3. Why is convex mirror used as side rear-view mirror in vehicles?',
        a: 'Because it curves outward, always produces an erect (upright) diminished image, and gives a much wider field of view of traffic behind.',
      },
    ],
    examChecklist: [
      'Compare Xylem (water/minerals upward) vs Phloem (food from leaves to all plant parts).',
      'Learn circuit symbols cleanly: cell, battery, open/closed switch, bulb, and fuse.',
      'Review natural indicators: Litmus, Turmeric (red in base), China Rose (dark pink in acid, green in base).',
    ],
  },
  {
    id: 'cbse_c7_social_science',
    classLevel: 7,
    subject: 'Social Science',
    chapterName: 'Our Pasts II, Environment & Civics',
    title: 'Class 7 CBSE Social Science Complete Notes (History, Geography, Civics)',
    description:
      'Free CBSE Class 7 Social Science NCERT study pack covering Medieval Indian History (Delhi Sultanate, Mughals, Bhakti/Sufi), Geography (Environment, Earth Interior, Air, Water, Deserts), and Civics (Equality, State Government, Media & Markets).',
    coverUrl: '/src/assets/images/cover_physics_optics_1794512073101.jpg',
    createdAt: '2026-02-02T09:10:00.000Z',
    syllabusUnits: [
      'History (Our Pasts II): New Kings & Kingdoms (Cholas), Delhi 12th-15th Century, Mughals (16th-17th Century), Bhakti & Sufi Saints',
      'Geography (Our Environment): Environment, Inside Our Earth (Rocks), Our Changing Earth, Air (Atmosphere Layers), Water (Tides & Currents), Life in Deserts',
      'Civics (Social & Political Life II): On Equality, How State Government Works, Role of Government in Health, Growing Up as Boys & Girls, Understanding Media, Markets',
    ],
    coreConcepts: [
      {
        heading: 'Chola Administration & Delhi Sultanate',
        detail:
          'Cholas had flourishing village assemblies (Ur & Sabha recorded in Uttaramerur inscriptions). Delhi Sultanate saw five dynasties: Slave, Khalji, Tughlaq, Sayyid, Lodi.',
      },
      {
        heading: 'Mughal Administration (Mansabdari & Zabti)',
        detail:
          'Akbar introduced Sulh-i-kul (universal peace) and Mansabdari rank system (Zat & Sawar); Todar Mal systematized Zabti land revenue.',
      },
      {
        heading: 'Interior of Earth & Rock Cycle',
        detail:
          '3 layers: Crust (sial/sima, thinnest), Mantle (2900 km deep), Core (Nife — nickel & iron, highest temp/pressure). 3 Rocks: Igneous (primary/molten), Sedimentary (layered, contains fossils), Metamorphic (heat & pressure).',
      },
      {
        heading: 'State Legislature: MLA, Chief Minister & Governor',
        detail:
          'Citizens elect MLAs from constituencies. Majority party chooses the Chief Minister; Governor is appointed by the Central Government as constitutional head.',
      },
    ],
    formulasAndRules: [
      'Atmosphere 5 Layers (Bottom to Top): Troposphere (weather) -> Stratosphere (ozone layer, planes) -> Mesosphere (meteorites burn) -> Thermosphere (radio waves) -> Exosphere.',
      'Erosional/Depositional Landforms: River -> Waterfall, Meander, Oxbow Lake, Delta | Glacier -> Moraines | Wind -> Mushroom Rock, Sand Dunes, Loess.',
      'Article 15 of Indian Constitution prohibits discrimination on religion, race, caste, sex, or place of birth.',
      'Water Distribution: ~97.3% Saline Oceans, ~2.0% Ice Caps, ~0.68% Groundwater & Freshwater Lakes.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Explain the difference between Public and Private Healthcare Services.',
        a: 'Public health centres are government-funded, affordable/free for all citizens, and run via taxes. Private facilities are profit-run, cost higher, and concentrated mainly in urban areas.',
      },
      {
        q: 'Q2. Why do cold and warm ocean currents affect coastal fishing & climate?',
        a: 'Places where warm and cold currents meet (e.g., Japan coast, eastern North America) produce dense fog and form the richest fishing grounds in the world.',
      },
    ],
    examChecklist: [
      'Learn chronological sequence of major Mughal Emperors: Babur -> Humayun -> Akbar -> Jahangir -> Shah Jahan -> Aurangzeb.',
      'Contrast Spring Tides (Full/New Moon) vs Neap Tides (Half Moon).',
      'Revise difference between wholesale markets, weekly markets, and shopping malls.',
    ],
  },
  {
    id: 'cbse_c7_english',
    classLevel: 7,
    subject: 'English',
    chapterName: 'Honeycomb, An Alien Hand & Grammar',
    title: 'Class 7 CBSE English Complete Literature, Grammar & Composition Pack',
    description:
      'Free CBSE Class 7 NCERT English revision notes covering Honeycomb prose & poetry, An Alien Hand supplementary reader, Active/Passive Voice, Direct/Indirect Speech, Clauses, Conjunctions, and Story/Letter Writing.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-02T09:15:00.000Z',
    syllabusUnits: [
      'Honeycomb Prose & Poems: Three Questions, A Gift of Chappals, Gopal and the Hilsa Fish, Quality, Trees, Meadow Surprises',
      'An Alien Hand: The Tiny Teacher, Bringing Up Kari, Golu Grows a Nose, Chandni, A Tiger in the House',
      'Grammar & Writing: Active & Passive Voice, Reported Speech, Modals, Determiners, Formal Letters, Email & Story Writing',
    ],
    coreConcepts: [
      {
        heading: 'Three Questions (Leo Tolstoy) Central Wisdom',
        detail:
          'The most important time is NOW (because it is the only time we have power to act); the most important person is the one with you right now; the most important business is to do good to that person.',
      },
      {
        heading: 'Active vs Passive Voice Rules',
        detail:
          'Object of Active becomes Subject of Passive + helping verb (be form matching tense) + V3 (past participle) + by + Agent.',
      },
      {
        heading: 'Direct to Indirect (Reported) Speech',
        detail:
          'Remove quotation marks, add "that", shift pronouns logically, and backshift tense when reporting verb is in past ("said"): is->was, simple present->simple past, will->would, today->that day.',
      },
    ],
    formulasAndRules: [
      'Passive Simple Present: is/am/are + V3 | Simple Past: was/were + V3 | Present Continuous: is/am/are + being + V3.',
      'Modals: Can (ability), May (permission/possibility), Must (strong obligation), Should (advice). Always followed by base verb V1.',
      'Story Writing Elements: Catchy Title -> Setting & Characters -> Conflict/Climax -> Resolution -> Crisp Moral.',
      'Email Writing Box Format: From -> To -> Date -> Subject -> Salutation -> Concise Body -> Sign-off.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Convert to Passive Voice: "The students planted twenty saplings."',
        a: '"Twenty saplings were planted by the students."',
      },
      {
        q: 'Q2. Convert to Indirect Speech: Riya said, "I am revising English grammar now."',
        a: 'Riya said that she was revising English grammar then.',
      },
    ],
    examChecklist: [
      'Review Mr. Gessler\'s devotion to craftsmanship in "Quality" and Abbu Khan\'s goat in "Chandni".',
      'Practice editing/omission grammar passages carefully one line at a time.',
      'Double-check punctuation and formal tone in Editor / Principal letters.',
    ],
  },
  {
    id: 'cbse_c7_hindi',
    classLevel: 7,
    subject: 'Hindi',
    chapterName: 'Vasant Bhag 2, Mahabharat & Vyakaran',
    title: 'Class 7 CBSE Hindi (Vasant Bhag 2 + Mahabharat + Vyakaran) Notes',
    description:
      'Free CBSE Class 7 NCERT Hindi study notes covering Vasant Bhag 2 chapters, Bal Mahabharat Katha key episodes, Hindi Vyakaran (Upsarg-Pratyay, Samas, Sandhi, Vakya Bhed, Muhavare-Lokoktiyan), and Nibandh/Patra Lekhan.',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-02T09:20:00.000Z',
    syllabusUnits: [
      'Vasant Bhag 2: Hum Panchhi Unmukt Gagan Ke, Himalaya Ki Betiyan, Kathputli, Mithaiwala, Rakt aur Hamara Sharir, Rahim Ke Dohe, Khanpan Ki Badalti Tasveer',
      'Bal Mahabharat Katha: Bhishma Pratigya, Yaksha Prashn, Virat Parva, Geeta Updesh',
      'Hindi Vyakaran: Upsarg & Pratyay, Samas, Sandhi, Kriya-Visheshan, Vakya Rachna, Patra & Nibandh Lekhan',
    ],
    coreConcepts: [
      {
        heading: 'Vasant Key Chapters & Values',
        detail:
          '"Hum Panchhi Unmukt Gagan Ke" (Shivmangal Singh Suman) celebrates freedom over golden cages. "Rakt aur Hamara Sharir" explains RBC, WBC, Platelets, and haemoglobin scientifically. Rahim Ke Dohe teach true friendship and humility.',
      },
      {
        heading: 'Upsarg (Prefix) & Pratyay (Suffix)',
        detail:
          'Upsarg attaches BEFORE the root word to alter meaning (e.g., Pra + Har = Prahar, Up + Van = Upvan). Pratyay attaches AFTER the root word (e.g., Daya + Alu = Dayalu, Sundar + Ta = Sundarta).',
      },
      {
        heading: 'Samas (Compound Words)',
        detail:
          'Dvandva Samas (Mata-Pita = Mata aur Pita), Dvigu Samas (Chauraha = Char rahon ka samuh), Tatpurush Samas (Rasoi-ghar = Rasoi ke liye ghar), Karmadharay Samas (Neelkamal).',
      },
    ],
    formulasAndRules: [
      'Avikari (Avyaya) 4 Parts: Kriya-visheshan, Sambandh-bodhak, Samuchchay-bodhak, Vismayadi-bodhak.',
      'Arth ke Adhar par Vakya Bhed: Vidhan-vachak, Nishedh-vachak, Prashn-vachak, Agya-vachak, Ichchha-vachak.',
      'Mool Shabd Isolation Rule: When separating Upsarg/Pratyay, the remaining Mool Shabd MUST have an independent dictionary meaning.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Separate Upsarg and Mool Shabd in "Vigyan" and "Abhiman".',
        a: 'Vigyan = Vi (Upsarg) + Gyan (Mool Shabd); Abhiman = Abhi (Upsarg) + Man (Mool Shabd).',
      },
      {
        q: 'Q2. Explain Rahim\'s "Kahi Rahim sampati sage..." couplet message.',
        a: 'True friends stand by you during times of adversity ("vipatti kasauti je kase"); fair-weather acquaintances gather only around wealth.',
      },
    ],
    examChecklist: [
      'Learn blood cell roles (RBC carries oxygen, WBC fights infections, Platelets help clotting).',
      'Practice Sandhi-Vichchhed and Samas Vigraha with 2 examples per type.',
      'Use clear headings (Bhumika, Mukhya Bhav, Upsanhar) for Nibandh Lekhan.',
    ],
  },
  {
    id: 'cbse_c7_sanskrit',
    classLevel: 7,
    subject: 'Sanskrit',
    chapterName: 'Ruchira Bhag 2 & Madhyamik Vyakaran',
    title: 'Class 7 CBSE Sanskrit (Ruchira Bhag 2) Shlokas, Grammar & Anuvad',
    description:
      'Free CBSE Class 7 NCERT Sanskrit notes covering Ruchira Bhag 2 chapter translations, Subhashitani shloka anvaya, Shabd-Roop (Asmad, Yushmad, Tat, Mati, Nadi), Dhatu-Roop across 4 Lakaras (Lat, Lang, Lrit, Lot), Upsarga & Pratyay (Ktva, Tumun, Lyap).',
    coverUrl: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
    createdAt: '2026-02-02T09:25:00.000Z',
    syllabusUnits: [
      'Ruchira Bhag 2: Subhashitani, Durbuddhih Vinashyati, Swavalambanam, Sadacharah, Sankalpah Siddhidayakah, Vidyadhanam',
      'Sarvanam & Ikarant Shabd-Roop: Asmad (I), Yushmad (You), Tat (3 genders), Mati (f), Nadi (f), Madhu (n)',
      'Dhatu-Roop & Pratyay: Char, Vas, Kri, Bhav, Path in Lat, Lrit, Lang (Past), Lot (Command); Ktva, Lyap & Tumun Pratyay',
    ],
    coreConcepts: [
      {
        heading: 'Subhashitani & Vidyadhanam Core Slokas',
        detail:
          'Satya (truth), Vidya (knowledge that grows when shared — "vyaye krite vardhata eva nityam"), and Sadachara (good conduct) are celebrated as the greatest wealth.',
      },
      {
        heading: 'Lang Lakar (Past Tense) Identification',
        detail:
          'Prefixes "a-" before the verb root: apathat (he read), apathatam (two read), apathan (they read); apatham (I read).',
      },
      {
        heading: 'Ktva, Lyap & Tumun Pratyay Usage',
        detail:
          'Ktva (-tva: having done, e.g., pathitva = having read); Lyap (-ya with upsarga, e.g., agamya = having come); Tumun (-tum: in order to, e.g., pathitum = to read).',
      },
    ],
    formulasAndRules: [
      'Lat (Present): -ti, -tah, -nti | Lrit (Future): -syati, -syatah, -syanti | Lot (Order/Request): -tu, -tam, -ntu.',
      'Asmad (Prathama): Aham, Avam, Vayam | Yushmad (Prathama): Tvam, Yuvam, Yuyam.',
      'Time Reading (Ghatika): 5:00 = Panch-vadanam, 5:15 = Sapad-panch-vadanam, 5:30 = Sardh-panch-vadanam, 5:45 = Padon-shad-vadanam.',
      'Vidyadhanam rule: No thief can steal it, no king can confiscate it, brothers cannot divide it.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Join root + pratyay: (a) path + ktva  (b) kri + tumun  (c) a + gam + lyap.',
        a: '(a) pathitva (having read)  (b) kartum (to do)  (c) agatya / agamya (having come).',
      },
      {
        q: 'Q2. Write Sanskrit time for 6:30 and 7:45.',
        a: '6:30 = Sardh-shad-vadanam; 7:45 = Padon-asht-vadanam.',
      },
    ],
    examChecklist: [
      'Master Padon (quarter-to, uses NEXT hour!) vs Sapad (quarter-past) for time-telling questions.',
      'Practice Anvaya matching for Subhashitani shlokas.',
      'Check gender matching for Sankhya 1-4 (ekah/eka/ekam, dvau/dve/dve, trayah/tisrah/trini).',
    ],
  },
  {
    id: 'cbse_c7_computer_science',
    classLevel: 7,
    subject: 'Computer Science',
    chapterName: 'Number Systems, Python Basics & HTML/CSS',
    title: 'Class 7 CBSE Computer Science (Binary Systems, Python & HTML/CSS) Notes',
    description:
      'Free CBSE Class 7 Computer Science revision notes covering Binary/Octal/Hexadecimal Number Systems, Advanced Excel Charts & Filtering, HTML Tables & Links, CSS Inline/Internal Styling, Python Basics (Variables, Print, Input, If-Else), and Cyber Ethics.',
    coverUrl: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
    createdAt: '2026-02-02T09:30:00.000Z',
    syllabusUnits: [
      'Unit 1: Number Systems (Binary Base-2, Decimal Base-10, Octal Base-8, Hexadecimal Base-16 & Conversions)',
      'Unit 2: Spreadsheet Charts, Sorting, Filtering & Conditional Formatting',
      'Unit 3: Python Fundamentals (Data Types, input(), print(), Arithmetic Operators, if-elif-else)',
      'Unit 4: HTML Lists, Tables, Hyperlinks & Cyber Security (Phishing, Digital Footprint)',
    ],
    coreConcepts: [
      {
        heading: 'Decimal to Binary & Binary to Decimal Conversion',
        detail:
          'Divide decimal repeatedly by 2 noting remainders bottom-to-top to get Binary. Multiply each binary bit by powers of 2 (from right: 2^0, 2^1, 2^2...) and sum to get Decimal.',
      },
      {
        heading: 'Python Basic Syntax & Indentation',
        detail:
          'Python uses clean indentation (4 spaces) instead of curly braces. Variables need no type declaration: name = "Aarav", age = 12. input() always returns string unless wrapped with int().',
      },
      {
        heading: 'HTML Hyperlinks, Lists & Tables',
        detail:
          '<ul>/<ol> create bulleted/numbered lists with <li> items. <a href="url">Link</a> creates clickable links. <table> uses <tr> (row), <th> (header), and <td> (data cell).',
      },
    ],
    formulasAndRules: [
      'Binary Arithmetic: 0+0=0 | 0+1=1 | 1+0=1 | 1+1=10 (0 with carry 1) | 1+1+1=11 (1 with carry 1).',
      'Python Operators: // (Floor division, e.g., 7//2 = 3), % (Modulus remainder, e.g., 7%2 = 1), ** (Exponent, 2**3 = 8).',
      'Binary Place Values (Right to Left): 1, 2, 4, 8, 16, 32, 64, 128.',
      'Digital Ethics: Phishing uses fake emails/links to steal credentials; never click suspicious attachments.',
    ],
    solvedQuestions: [
      {
        q: 'Q1. Convert Decimal 25 into Binary.',
        a: '25/2 = 12 r 1; 12/2 = 6 r 0; 6/2 = 3 r 0; 3/2 = 1 r 1; 1/2 = 0 r 1. Reading bottom-up: (11001)_2.',
      },
      {
        q: 'Q2. Write a short Python snippet to check whether a number n is even or odd.',
        a: 'n = int(input("Enter number: "))\nif n % 2 == 0: print("Even")\nelse: print("Odd")',
      },
    ],
    examChecklist: [
      'Verify Binary -> Decimal answers back using weights (16 + 8 + 1 = 25).',
      'Remember Python is case-sensitive: Print() gives NameError; use lowercase print().',
      'Check closing tags on HTML tables (</table>, </tr>, </td>).',
    ],
  },
];

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawFooter(page: PDFPage, regularFont: PDFFont, pageNum: number, totalPages: number, spec: CuratedCbseSpec) {
  page.drawLine({
    start: { x: 48, y: 42 },
    end: { x: 547, y: 42 },
    thickness: 0.75,
    color: rgb(0.85, 0.88, 0.93),
  });
  page.drawText(
    `NOTE XCHANGE Open CBSE Library  |  Class ${spec.classLevel} ${spec.subject} (Free NCERT Notes)`,
    {
      x: 48,
      y: 26,
      size: 8.5,
      font: regularFont,
      color: rgb(0.42, 0.48, 0.57),
    }
  );
  page.drawText(`Page ${pageNum} of ${totalPages}`, {
    x: 495,
    y: 26,
    size: 8.5,
    font: regularFont,
    color: rgb(0.42, 0.48, 0.57),
  });
}

async function buildStudyPdfBytes(spec: CuratedCbseSpec): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(spec.title);
  pdfDoc.setAuthor(CBSE_CURATOR_PROFILE.fullName);
  pdfDoc.setSubject(`CBSE Class ${spec.classLevel} ${spec.subject}`);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;
  const blue = rgb(0.11, 0.31, 0.85);
  const violet = rgb(0.43, 0.16, 0.85);
  const darkText = rgb(0.08, 0.12, 0.2);
  const mutedText = rgb(0.35, 0.42, 0.52);

  // ---------------- PAGE 1: Header, Chapter Scope & Core Concepts ----------------
  const p1 = pdfDoc.addPage([pageWidth, pageHeight]);
  p1.drawRectangle({ x: 0, y: 742, width: pageWidth, height: 100, color: blue });
  p1.drawText(`NOTE XCHANGE  |  CBSE BOARD  |  CLASS ${spec.classLevel}  |  FREE STUDY NOTES`, {
    x: marginX,
    y: 814,
    size: 9.5,
    font: bold,
    color: rgb(0.84, 0.91, 1),
  });

  const titleLines = wrapText(spec.title, bold, 16, contentWidth).slice(0, 2);
  let titleY = 790;
  for (const line of titleLines) {
    p1.drawText(line, { x: marginX, y: titleY, size: 16, font: bold, color: rgb(1, 1, 1) });
    titleY -= 20;
  }

  let y = 716;
  p1.drawText(`Subject: ${spec.subject}    |    Scope: ${spec.chapterName}`, {
    x: marginX,
    y,
    size: 10,
    font: bold,
    color: violet,
  });
  y -= 24;

  p1.drawText('1. NCERT Syllabus Units Covered', { x: marginX, y, size: 12.5, font: bold, color: darkText });
  y -= 18;
  for (const unit of spec.syllabusUnits) {
    const lines = wrapText(`- ${unit}`, regular, 10, contentWidth);
    for (const ln of lines) {
      p1.drawText(ln, { x: marginX + 6, y, size: 10, font: regular, color: mutedText });
      y -= 14;
    }
    y -= 2;
  }

  y -= 12;
  p1.drawText('2. Core Concepts & Key Explanations', { x: marginX, y, size: 12.5, font: bold, color: darkText });
  y -= 18;
  for (const concept of spec.coreConcepts) {
    if (y < 90) break;
    p1.drawText(concept.heading, { x: marginX, y, size: 11, font: bold, color: blue });
    y -= 15;
    const lines = wrapText(concept.detail, regular, 10, contentWidth);
    for (const ln of lines) {
      if (y < 70) break;
      p1.drawText(ln, { x: marginX, y, size: 10, font: regular, color: darkText });
      y -= 14;
    }
    y -= 10;
  }
  drawFooter(p1, regular, 1, 3, spec);

  // ---------------- PAGE 2: Formulas, Rules & Key Summary ----------------
  const p2 = pdfDoc.addPage([pageWidth, pageHeight]);
  p2.drawRectangle({ x: 0, y: 786, width: pageWidth, height: 56, color: rgb(0.95, 0.97, 1) });
  p2.drawText(`Class ${spec.classLevel} CBSE ${spec.subject} — Key Formulas, Rules & Quick Facts`, {
    x: marginX,
    y: 808,
    size: 13,
    font: bold,
    color: blue,
  });

  y = 754;
  p2.drawText('3. Important Formulas, Grammar Rules & Key Tables', {
    x: marginX,
    y,
    size: 12.5,
    font: bold,
    color: darkText,
  });
  y -= 22;

  for (const rule of spec.formulasAndRules) {
    const lines = wrapText(rule, regular, 10.5, contentWidth - 24);
    const boxHeight = lines.length * 15 + 14;
    p2.drawRectangle({
      x: marginX,
      y: y - boxHeight + 14,
      width: contentWidth,
      height: boxHeight,
      color: rgb(0.97, 0.98, 1),
      borderColor: rgb(0.84, 0.89, 0.97),
      borderWidth: 0.75,
    });
    let lineY = y - 2;
    for (const ln of lines) {
      p2.drawText(ln, { x: marginX + 12, y: lineY, size: 10.5, font: regular, color: darkText });
      lineY -= 15;
    }
    y -= boxHeight + 10;
  }
  drawFooter(p2, regular, 2, 3, spec);

  // ---------------- PAGE 3: Solved Questions & Exam Checklist ----------------
  const p3 = pdfDoc.addPage([pageWidth, pageHeight]);
  p3.drawRectangle({ x: 0, y: 786, width: pageWidth, height: 56, color: rgb(0.96, 0.95, 1) });
  p3.drawText(`Class ${spec.classLevel} CBSE ${spec.subject} — Solved Practice & Exam Checklist`, {
    x: marginX,
    y: 808,
    size: 13,
    font: bold,
    color: violet,
  });

  y = 754;
  p3.drawText('4. Solved NCERT & School Exam Questions', {
    x: marginX,
    y,
    size: 12.5,
    font: bold,
    color: darkText,
  });
  y -= 20;

  for (const qa of spec.solvedQuestions) {
    const qLines = wrapText(qa.q, bold, 10.5, contentWidth);
    for (const ln of qLines) {
      p3.drawText(ln, { x: marginX, y, size: 10.5, font: bold, color: darkText });
      y -= 15;
    }
    const aLines = wrapText(`Answer: ${qa.a}`, regular, 10, contentWidth - 10);
    for (const ln of aLines) {
      p3.drawText(ln, { x: marginX + 10, y, size: 10, font: regular, color: mutedText });
      y -= 14;
    }
    y -= 12;
  }

  y -= 12;
  p3.drawText('5. Last-Minute CBSE Exam Revision Checklist', {
    x: marginX,
    y,
    size: 12.5,
    font: bold,
    color: darkText,
  });
  y -= 18;
  for (const tip of spec.examChecklist) {
    const lines = wrapText(`[Check] ${tip}`, regular, 10, contentWidth - 8);
    for (const ln of lines) {
      p3.drawText(ln, { x: marginX + 6, y, size: 10, font: regular, color: darkText });
      y -= 14;
    }
    y -= 6;
  }

  drawFooter(p3, regular, 3, 3, spec);
  return pdfDoc.save();
}

const curatedNoteCache = new Map<string, StudyNote>();

export async function ensureCbseClass6And7Pdfs(): Promise<void> {
  ensureStorageDirs();
  for (const spec of CURATED_CBSE_SPECS) {
    const privatePath = path.join(PRIVATE_PDF_DIR, `${spec.id}.pdf`);
    const previewPath = path.join(PREVIEW_PDF_DIR, `${spec.id}.pdf`);

    let fileSizeBytes = 0;
    if (!fs.existsSync(privatePath) || !fs.existsSync(previewPath)) {
      const fullBytes = await buildStudyPdfBytes(spec);
      fs.writeFileSync(privatePath, Buffer.from(fullBytes));
      fileSizeBytes = fullBytes.length;

      const fullDoc = await PDFDocument.load(fullBytes);
      const previewDoc = await PDFDocument.create();
      const previewCount = Math.min(2, fullDoc.getPageCount());
      const copied = await previewDoc.copyPages(
        fullDoc,
        Array.from({ length: previewCount }, (_, i) => i)
      );
      for (const page of copied) {
        previewDoc.addPage(page);
      }
      const previewBytes = await previewDoc.save();
      fs.writeFileSync(previewPath, Buffer.from(previewBytes));
    } else {
      fileSizeBytes = fs.statSync(privatePath).size;
    }

    curatedNoteCache.set(spec.id, {
      id: spec.id,
      sellerId: CBSE_CURATOR_UID,
      sellerUsername: CBSE_CURATOR_PROFILE.username,
      sellerName: CBSE_CURATOR_PROFILE.fullName,
      title: spec.title,
      description: spec.description,
      classLevel: spec.classLevel,
      subject: spec.subject,
      chapterName: spec.chapterName,
      board: 'CBSE',
      price: 0,
      isFree: true,
      coverUrl: spec.coverUrl,
      pdfFileId: spec.id,
      pageCount: 3,
      fileSizeBytes,
      status: 'approved',
      originalityAttested: true,
      averageRating: 4.9,
      ratingCount: 0,
      purchaseCount: 0,
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
    });
  }
}

export function listCuratedCbseNotes(): StudyNote[] {
  if (curatedNoteCache.size === 0) {
    return CURATED_CBSE_SPECS.map((spec) => {
      const privatePath = path.join(PRIVATE_PDF_DIR, `${spec.id}.pdf`);
      const fileSizeBytes = fs.existsSync(privatePath) ? fs.statSync(privatePath).size : 18500;
      return {
        id: spec.id,
        sellerId: CBSE_CURATOR_UID,
        sellerUsername: CBSE_CURATOR_PROFILE.username,
        sellerName: CBSE_CURATOR_PROFILE.fullName,
        title: spec.title,
        description: spec.description,
        classLevel: spec.classLevel,
        subject: spec.subject,
        chapterName: spec.chapterName,
        board: 'CBSE',
        price: 0,
        isFree: true,
        coverUrl: spec.coverUrl,
        pdfFileId: spec.id,
        pageCount: 3,
        fileSizeBytes,
        status: 'approved',
        originalityAttested: true,
        averageRating: 4.9,
        ratingCount: 0,
        purchaseCount: 0,
        createdAt: spec.createdAt,
        updatedAt: spec.createdAt,
      };
    });
  }
  return Array.from(curatedNoteCache.values());
}

export function getCuratedCbseNote(noteId: string): StudyNote | null {
  return listCuratedCbseNotes().find((n) => n.id === noteId) || null;
}
