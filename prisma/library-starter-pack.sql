-- Glory Schools Learning Library: starter pack, sorted by class
-- Run in the Neon console SQL Editor. Safe to run twice.
--
-- STEP 1 (optional, but do it if anything looks wrong): run this alone and check your class names.
--   SELECT "name" FROM "Class" ORDER BY "name";
-- The script recognises: Creche/Crèche, KG1, KG2, Nursery 1/2 (also NUR1/NUR2, NOST1/NOST2), Primary 1-5, JS1-JS3 (also GS1-3, JSS1-3), SS1-SS3 (also SSS1-3)
-- (spaces, capitals and extra letters such as "Primary 1A" are fine).
--
-- STEP 2: run everything below in one go.
--
-- What it does:
--   * Removes the earlier "all classes" copies of these same items, if you ran the first version.
--   * Adds each item once for every class it suits (a class can only hold one copy of an item,
--     so one resource shows up as several rows, one per class).
--   * addedById = the first ADMIN user. subjectId = matched by name (stays empty if no subject matches).

WITH v(title, descr, type, topic, source, url, subj, levels) AS (VALUES
  -- ───────── Early years: Crèche, KG1, KG2, Nursery 1-2 ─────────
  ('Khan Academy Kids', 'Free early-learning games, books and videos for ages 2 to 8.', 'PRACTICAL', 'Learning games', 'Khan Academy Kids', 'https://learn.khanacademykids.org', NULL, 'ey,primary1,primary2,primary3'),
  ('African Storybook', 'Thousands of free picture storybooks in African languages and English for children aged 2 to 10.', 'STORYBOOK', 'Storybooks', 'African Storybook (Saide)', 'https://www.africanstorybook.org', 'English%', 'ey,pri'),
  ('StoryWeaver', 'Free illustrated children''s stories at several reading levels, in many languages.', 'STORYBOOK', 'Storybooks', 'Pratham Books', 'https://storyweaver.org.in', 'English%', 'ey,pri'),
  ('Storyline Online', 'Picture books read aloud on video. Good for listening and vocabulary.', 'VIDEO', 'Read-aloud stories', 'Storyline Online', 'https://storylineonline.net', 'English%', 'ey,pri'),
  ('Starfall', 'Free phonics, letters and early reading activities.', 'PRACTICAL', 'Phonics and early reading', 'Starfall', 'https://www.starfall.com', 'English%', 'ey,primary1,primary2,primary3'),
  ('Super Simple Songs', 'Action songs and rhymes for young children, in simple English.', 'VIDEO', 'Songs and rhymes', 'Super Simple Songs (YouTube)', 'https://www.youtube.com/@SuperSimpleSongs', 'English%', 'ey,primary1,primary2'),
  ('SciShow Kids (videos)', 'Short science videos for young children.', 'VIDEO', 'Basic Science', 'SciShow Kids (YouTube)', 'https://www.youtube.com/@SciShowKids', '%Science%', 'ey,pri'),
  ('British Council: LearnEnglish Kids', 'Songs, stories, games and worksheets for young learners of English.', 'WORKSHEET', 'English', 'British Council', 'https://learnenglishkids.britishcouncil.org', 'English%', 'ey,pri'),

  -- ───────── Primary 1-5 (and some for JSS) ─────────
  ('Math Antics (videos)', 'Short, friendly videos on fractions, decimals, geometry and more.', 'VIDEO', 'Mathematics', 'Math Antics (YouTube)', 'https://www.youtube.com/@mathantics', 'Math%', 'pri,js'),
  ('NASA Space Place', 'Simple explanations, games and pictures about space and Earth science.', 'NOTES', 'Space and Earth', 'NASA', 'https://spaceplace.nasa.gov', '%Science%', 'pri,js'),
  ('National Geographic Kids', 'Animals, geography and science facts with pictures and videos.', 'PICTURE', 'Nature and geography', 'National Geographic', 'https://kids.nationalgeographic.com', '%Science%', 'pri,js'),
  ('Scratch', 'Free block-based coding to make stories, games and animations.', 'PRACTICAL', 'Computer Studies', 'MIT Scratch', 'https://scratch.mit.edu', 'Computer%', 'pri,js'),

  -- ───────── Mathematics ─────────
  ('Khan Academy: Mathematics', 'Free video lessons and practice from early years to senior secondary.', 'VIDEO', 'Mathematics', 'Khan Academy', 'https://www.khanacademy.org/math', 'Math%', 'pri,js,ss'),
  ('Siyavula: Mathematics textbooks', 'Free open textbooks with worked examples and practice (South African syllabus, content matches closely).', 'TEXTBOOK', 'Mathematics', 'Siyavula', 'https://www.siyavula.com', 'Math%', 'js,ss'),
  ('OpenStax: Math textbooks', 'Free senior-secondary and college maths textbooks to read online or download.', 'TEXTBOOK', 'Mathematics', 'OpenStax', 'https://openstax.org/subjects/math', 'Math%', 'ss'),

  -- ───────── Sciences ─────────
  ('Khan Academy: Science', 'Biology, chemistry, physics and earth science videos with practice questions.', 'VIDEO', 'Science', 'Khan Academy', 'https://www.khanacademy.org/science', '%Science%', 'js,ss'),
  ('PhET Interactive Simulations', 'Free virtual labs for physics, chemistry, biology and maths. Good when you have no lab equipment.', 'PRACTICAL', 'Science practicals', 'PhET, University of Colorado', 'https://phet.colorado.edu', '%Science%', 'js,ss'),
  ('OpenStax: Science textbooks', 'Free biology, chemistry and physics textbooks.', 'TEXTBOOK', 'Science', 'OpenStax', 'https://openstax.org/subjects/science', '%Science%', 'ss'),
  ('Crash Course (videos)', 'Fast, clear video courses in chemistry, biology, physics, economics, literature and history.', 'VIDEO', 'Revision videos', 'Crash Course (YouTube)', 'https://www.youtube.com/@crashcourse', NULL, 'ss'),
  ('CK-12 FlexBooks', 'Free online textbooks, videos and practice for maths and science.', 'NOTES', 'Maths and Science', 'CK-12', 'https://www.ck12.org', NULL, 'js,ss'),

  -- ───────── English and Literature ─────────
  ('Khan Academy: Grammar', 'Free lessons on parts of speech, sentences and punctuation.', 'VIDEO', 'English grammar', 'Khan Academy', 'https://www.khanacademy.org/humanities/grammar', 'English%', 'js,ss'),
  ('Project Gutenberg', 'Over 70,000 free classic books to read online or download.', 'TEXTBOOK', 'Literature and reading', 'Project Gutenberg', 'https://www.gutenberg.org', 'English%', 'js,ss'),
  ('Open Library', 'Borrow millions of books online for free with a free account.', 'TEXTBOOK', 'Reading and research', 'Internet Archive', 'https://openlibrary.org', 'English%', 'pri,js,ss'),

  -- ───────── Humanities, Business, Religion ─────────
  ('Khan Academy: Economics', 'Micro and macroeconomics video lessons and practice.', 'VIDEO', 'Economics', 'Khan Academy', 'https://www.khanacademy.org/economics-finance-domain', 'Economics%', 'ss'),
  ('OpenStax: Business and Economics', 'Free textbooks covering economics, accounting and business.', 'TEXTBOOK', 'Economics, Commerce, Accounting', 'OpenStax', 'https://openstax.org/subjects/business', 'Economics%', 'ss'),
  ('TED-Ed (videos)', 'Short animated lessons on history, literature, science and civics.', 'VIDEO', 'Enrichment videos', 'TED-Ed (YouTube)', 'https://www.youtube.com/@TEDEd', NULL, 'js,ss'),
  ('BibleProject (videos)', 'Animated overviews of each book of the Bible, helpful for Christian Religious Studies.', 'VIDEO', 'Christian Religious Studies', 'BibleProject', 'https://bibleproject.com', '%Christian%', 'js,ss'),

  -- ───────── Computer Studies ─────────
  ('Code.org', 'Free coding lessons for all ages, no experience needed.', 'PRACTICAL', 'Computer Studies', 'Code.org', 'https://code.org', 'Computer%', 'pri,js,ss'),
  ('Khan Academy: Computing', 'Programming, algorithms and internet basics.', 'VIDEO', 'Computer Studies', 'Khan Academy', 'https://www.khanacademy.org/computing', 'Computer%', 'ss'),
  ('TypingClub', 'Free typing lessons that build keyboard speed and accuracy.', 'PRACTICAL', 'Computer Studies', 'TypingClub', 'https://www.typingclub.com', 'Computer%', 'pri,js,ss'),

  -- ───────── Whole-curriculum lesson sites ─────────
  ('BBC Bitesize', 'Revision notes, videos and quizzes across most school subjects.', 'NOTES', 'All subjects', 'BBC', 'https://www.bbc.co.uk/bitesize', NULL, 'pri,js,ss'),
  ('Oak National Academy', 'Free full video lessons with slides and worksheets for most subjects.', 'VIDEO', 'All subjects', 'Oak National Academy', 'https://www.thenational.academy', NULL, 'pri,js,ss'),

  -- ───────── Nigerian exam preparation ─────────
  ('SchoolNGR Classroom: past questions', 'Free past questions for BECE, WAEC, NECO, JAMB and Post-UTME across many subjects.', 'EXAM_PREP', 'Past questions', 'SchoolNGR', 'https://www.schoolngr.com/classroom', NULL, 'gs3,js3,ss'),
  ('WAEC Nigeria: e-Learning and exam information', 'Official WAEC site: study guides, exam registration and results.', 'EXAM_PREP', 'WAEC preparation', 'WAEC Nigeria', 'https://www.waeconline.org.ng', NULL, 'ss'),
  ('JAMB: official site and UTME syllabus', 'Official JAMB site with the syllabus and exam information for UTME candidates.', 'EXAM_PREP', 'JAMB preparation', 'JAMB', 'https://www.jamb.gov.ng', NULL, 'ss2,ss3')
),
-- Work out which of your classes is which, whatever spelling you used.
cls AS (
  SELECT c."id",
         (regexp_match(
            regexp_replace(translate(lower(c."name"), 'èé', 'ee'), '[^a-z0-9]', '', 'g'),
            '(creche|kg[12]|nursery[12]|nur[12]|nost[12]|primary[1-5]|pry[1-5]|juniorsecondary[1-3]|jss[1-3]|js[1-3]|gs[1-3]|seniorsecondary[1-3]|sss[1-3]|ss[1-3])'
         ))[1] AS r
  FROM "Class" c
),
cls2 AS (
  SELECT id,
         g,
         CASE WHEN g = 'js' THEN 'js' || right(r, 1)
              WHEN g = 'ss' THEN 'ss' || right(r, 1)
              ELSE r END AS k
  FROM (
    SELECT id, r,
           CASE WHEN r IN ('creche','kg1','kg2') OR r LIKE 'nur%' OR r LIKE 'nost%' THEN 'ey'
                WHEN r LIKE 'primary%' OR r LIKE 'pry%' THEN 'pri'
                WHEN r ~ '^(gs|js|jss|juniorsecondary)[1-3]$' THEN 'js'
                ELSE 'ss' END AS g
    FROM cls WHERE r IS NOT NULL
  ) t
),
-- Remove the earlier "all classes" copies of these same items (only rows with no class).
del AS (
  DELETE FROM "LibraryItem" li
  USING v
  WHERE li."classId" IS NULL AND li."url" = v.url AND li."title" = v.title
  RETURNING 1
)
INSERT INTO "LibraryItem" ("id","title","description","type","topic","sourceName","url","classId","subjectId","addedById")
SELECT
  gen_random_uuid()::text,
  v.title,
  v.descr,
  v.type::"LibraryItemType",
  v.topic,
  v.source,
  v.url,
  cls2.id,
  (SELECT s."id" FROM "Subject" s WHERE s."name" ILIKE v.subj LIMIT 1),
  (SELECT u."id" FROM "User" u WHERE u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1)
FROM v
JOIN cls2
  ON cls2.g = ANY (string_to_array(v.levels, ','))
  OR cls2.k = ANY (string_to_array(v.levels, ','))
WHERE NOT EXISTS (
  SELECT 1 FROM "LibraryItem" li
  WHERE li."classId" = cls2.id AND li."url" = v.url AND li."title" = v.title
);

-- STEP 3 (check): how many items each class now has. A class missing from this list was not recognised.
-- SELECT c."name", count(li."id") AS items
-- FROM "Class" c LEFT JOIN "LibraryItem" li ON li."classId" = c."id"
-- GROUP BY c."name" ORDER BY c."name";
