-- Glory Schools Learning Library: starter pack (Stage 1, links only)
-- Run in the Neon console SQL Editor. Safe to run twice: it skips anything already added.
--
-- How it works:
--  * addedById  = the first ADMIN user in your database.
--  * subjectId  = matched by name pattern (e.g. 'Math%'). If no subject matches, it stays empty.
--  * classId    = empty on purpose, so every class sees these. Level is shown at the start of the topic
--                 ("Primary", "Secondary", "All levels") so teachers can find and narrow items later.

INSERT INTO "LibraryItem" ("id","title","description","type","topic","sourceName","url","classId","subjectId","addedById")
SELECT
  gen_random_uuid()::text,
  v.title,
  v.descr,
  v.type::"LibraryItemType",
  v.topic,
  v.source,
  v.url,
  NULL,
  (SELECT s."id" FROM "Subject" s WHERE s."name" ILIKE v.subj LIMIT 1),
  (SELECT u."id" FROM "User" u WHERE u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1)
FROM (VALUES
  -- ───────── Mathematics ─────────
  ('Khan Academy: Mathematics', 'Free video lessons and practice from early years to senior secondary.', 'VIDEO', 'All levels – Mathematics', 'Khan Academy', 'https://www.khanacademy.org/math', 'Math%'),
  ('Math Antics (videos)', 'Short, friendly videos on fractions, decimals, geometry and more. Best for Primary and JSS.', 'VIDEO', 'Primary & JSS – Mathematics', 'Math Antics (YouTube)', 'https://www.youtube.com/@mathantics', 'Math%'),
  ('OpenStax: Math textbooks', 'Free college-level and senior-secondary maths textbooks you can read online or download.', 'TEXTBOOK', 'Secondary – Mathematics', 'OpenStax', 'https://openstax.org/subjects/math', 'Math%'),
  ('Siyavula: Mathematics textbooks', 'Free open textbooks with worked examples and practice (South African syllabus, content matches closely).', 'TEXTBOOK', 'Secondary – Mathematics', 'Siyavula', 'https://www.siyavula.com', 'Math%'),
  -- ───────── Sciences ─────────
  ('Khan Academy: Science', 'Biology, chemistry, physics and earth science videos with practice questions.', 'VIDEO', 'All levels – Science', 'Khan Academy', 'https://www.khanacademy.org/science', '%Science%'),
  ('PhET Interactive Simulations', 'Free virtual labs for physics, chemistry, biology and maths. Good when you have no lab equipment.', 'PRACTICAL', 'Secondary – Science practicals', 'PhET, University of Colorado', 'https://phet.colorado.edu', '%Science%'),
  ('OpenStax: Science textbooks', 'Free biology, chemistry and physics textbooks.', 'TEXTBOOK', 'Secondary – Science', 'OpenStax', 'https://openstax.org/subjects/science', '%Science%'),
  ('SciShow Kids (videos)', 'Short science videos for young children.', 'VIDEO', 'Primary – Basic Science', 'SciShow Kids (YouTube)', 'https://www.youtube.com/@SciShowKids', '%Science%'),
  ('Crash Course (videos)', 'Fast, clear video courses in chemistry, biology, physics, economics, literature and history.', 'VIDEO', 'Secondary – Revision videos', 'Crash Course (YouTube)', 'https://www.youtube.com/@crashcourse', NULL),
  ('NASA Space Place', 'Simple explanations, games and pictures about space and Earth science.', 'NOTES', 'Primary & JSS – Space and Earth', 'NASA', 'https://spaceplace.nasa.gov', '%Science%'),
  ('National Geographic Kids', 'Animals, geography and science facts with pictures and videos.', 'PICTURE', 'Primary – Nature and geography', 'National Geographic', 'https://kids.nationalgeographic.com', '%Science%'),
  ('CK-12 FlexBooks', 'Free online textbooks, videos and practice for maths and science.', 'NOTES', 'All levels – Maths and Science', 'CK-12', 'https://www.ck12.org', NULL),
  -- ───────── English & Literature ─────────
  ('Khan Academy: Grammar', 'Free lessons on parts of speech, sentences and punctuation.', 'VIDEO', 'JSS & SSS – English grammar', 'Khan Academy', 'https://www.khanacademy.org/humanities/grammar', 'English%'),
  ('British Council: LearnEnglish Kids', 'Songs, stories, games and worksheets for young learners of English.', 'WORKSHEET', 'Primary – English', 'British Council', 'https://learnenglishkids.britishcouncil.org', 'English%'),
  ('Project Gutenberg', 'Over 70,000 free classic books to read online or download, useful for literature texts in the public domain.', 'TEXTBOOK', 'Secondary – Literature and reading', 'Project Gutenberg', 'https://www.gutenberg.org', 'English%'),
  ('Open Library', 'Borrow millions of books online for free with a free account.', 'TEXTBOOK', 'All levels – Reading and research', 'Internet Archive', 'https://openlibrary.org', 'English%'),
  ('African Storybook', 'Thousands of free picture storybooks in African languages and English for children aged 2 to 10.', 'STORYBOOK', 'Early years & Primary – Storybooks', 'African Storybook (Saide)', 'https://www.africanstorybook.org', 'English%'),
  ('StoryWeaver', 'Free illustrated children''s stories at several reading levels, in many languages.', 'STORYBOOK', 'Early years & Primary – Storybooks', 'Pratham Books', 'https://storyweaver.org.in', 'English%'),
  -- ───────── Humanities, Business ─────────
  ('Khan Academy: Economics', 'Micro and macroeconomics video lessons and practice.', 'VIDEO', 'SSS – Economics', 'Khan Academy', 'https://www.khanacademy.org/economics-finance-domain', 'Economics%'),
  ('OpenStax: Business and Economics', 'Free textbooks covering economics, accounting and business.', 'TEXTBOOK', 'SSS – Economics, Commerce, Accounting', 'OpenStax', 'https://openstax.org/subjects/business', 'Economics%'),
  ('TED-Ed (videos)', 'Short animated lessons on history, literature, science and civics.', 'VIDEO', 'Secondary – Enrichment videos', 'TED-Ed (YouTube)', 'https://www.youtube.com/@TEDEd', NULL),
  ('BibleProject (videos)', 'Animated overviews of each book of the Bible, helpful for Christian Religious Studies.', 'VIDEO', 'Secondary – Christian Religious Studies', 'BibleProject', 'https://bibleproject.com', '%Christian%'),
  -- ───────── Computer studies ─────────
  ('Code.org', 'Free coding lessons for all ages, no experience needed.', 'PRACTICAL', 'All levels – Computer Studies', 'Code.org', 'https://code.org', 'Computer%'),
  ('Scratch', 'Free block-based coding to make stories, games and animations.', 'PRACTICAL', 'Primary & JSS – Computer Studies', 'MIT Scratch', 'https://scratch.mit.edu', 'Computer%'),
  ('Khan Academy: Computing', 'Programming, algorithms and internet basics.', 'VIDEO', 'SSS – Computer Studies', 'Khan Academy', 'https://www.khanacademy.org/computing', 'Computer%'),
  ('TypingClub', 'Free typing lessons that build keyboard speed and accuracy.', 'PRACTICAL', 'All levels – Computer Studies', 'TypingClub', 'https://www.typingclub.com', 'Computer%'),
  -- ───────── Whole-curriculum lesson sites ─────────
  ('BBC Bitesize', 'Revision notes, videos and quizzes across most school subjects.', 'NOTES', 'All levels – All subjects', 'BBC', 'https://www.bbc.co.uk/bitesize', NULL),
  ('Oak National Academy', 'Free full video lessons with slides and worksheets from reception to Year 11.', 'VIDEO', 'All levels – All subjects', 'Oak National Academy', 'https://www.thenational.academy', NULL),
  ('Khan Academy Kids', 'Free early-learning games, books and videos for ages 2 to 8.', 'PRACTICAL', 'Early years – Learning games', 'Khan Academy Kids', 'https://learn.khanacademykids.org', NULL),
  -- ───────── Nigerian exam preparation ─────────
  ('SchoolNGR Classroom: past questions', 'Free past questions for JAMB, WAEC, NECO, BECE and Post-UTME across many subjects.', 'EXAM_PREP', 'JSS & SSS – Past questions', 'SchoolNGR', 'https://www.schoolngr.com/classroom', NULL),
  ('WAEC Nigeria: e-Learning and exam information', 'Official WAEC site: study guides, exam registration and results.', 'EXAM_PREP', 'SSS – WAEC preparation', 'WAEC Nigeria', 'https://www.waeconline.org.ng', NULL),
  ('JAMB: official site and UTME syllabus', 'Official JAMB site with the syllabus and exam information for UTME candidates.', 'EXAM_PREP', 'SSS – JAMB preparation', 'JAMB', 'https://www.jamb.gov.ng', NULL)
) AS v(title, descr, type, topic, source, url, subj)
WHERE NOT EXISTS (SELECT 1 FROM "LibraryItem" li WHERE li."url" = v.url AND li."title" = v.title);

-- Check the result:
-- SELECT type, count(*) FROM "LibraryItem" GROUP BY type ORDER BY 2 DESC;
