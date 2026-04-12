const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'alexandria.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Remove existing DB for clean seed
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing database.');
}

const db = new Database(DB_PATH);

// Run schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);
console.log('Schema created.');

// ─── Seed Subjects ───
const subjects = [
    { name: 'History', slug: 'history', description: 'Exploring the events, cultures, and forces that shaped civilisation. From ancient empires to modern revolutions, we examine the past to illuminate the present.', sort_order: 1 },
    { name: 'Politics', slug: 'politics', description: 'Analysis of governance, power, and policy. We examine political systems, movements, and decisions that shape societies around the world.', sort_order: 2 },
    { name: 'Law', slug: 'law', description: 'Exploring legal frameworks, landmark cases, and the evolving relationship between justice and society across jurisdictions.', sort_order: 3 },
    { name: 'Economics', slug: 'economics', description: 'From macroeconomic policy to market dynamics, we analyse the forces that drive prosperity, inequality, and economic change.', sort_order: 4 },
    { name: 'Philosophy', slug: 'philosophy', description: 'Engaging with the fundamental questions of existence, ethics, knowledge, and meaning that have challenged thinkers for millennia.', sort_order: 5 },
];

const insertSubject = db.prepare('INSERT INTO subjects (name, slug, description, sort_order) VALUES (?, ?, ?, ?)');
for (const s of subjects) {
    insertSubject.run(s.name, s.slug, s.description, s.sort_order);
}
console.log('Subjects seeded.');

// ─── Seed Authors ───
const authors = [
    { name: 'Dr. Eleanor Whitfield', slug: 'eleanor-whitfield', bio: 'Historian specialising in ancient knowledge systems and the transmission of ideas across civilisations. Senior Fellow at the Oxford Institute for Historical Research.' },
    { name: 'Dr. Sarah Mitchell', slug: 'sarah-mitchell', bio: 'Political philosopher and ethicist focusing on technology governance. Associate Professor at the London School of Economics.' },
    { name: 'Prof. James Chen', slug: 'james-chen', bio: 'Economist and author examining post-industrial economic theory. Chair of Economic Policy at Cambridge University.' },
    { name: 'Maria Rodriguez, JD', slug: 'maria-rodriguez', bio: 'Legal scholar specialising in digital rights and data privacy law. Partner at Rodriguez & Associates, London.' },
    { name: 'Dr. Anika Sharma', slug: 'anika-sharma', bio: 'International relations scholar focused on Indo-Pacific geopolitics and multilateral governance structures.' },
    { name: 'Prof. Thomas Adeyemi', slug: 'thomas-adeyemi', bio: 'Classical historian researching pre-Athenian democratic traditions. Professor of Ancient History at SOAS, University of London.' },
];

const insertAuthor = db.prepare('INSERT INTO authors (name, slug, bio) VALUES (?, ?, ?)');
for (const a of authors) {
    insertAuthor.run(a.name, a.slug, a.bio);
}
console.log('Authors seeded.');

// ─── Seed Tags ───
const tags = [
    'Ancient History', 'Democracy', 'AI Ethics', 'Technology',
    'Data Privacy', 'Surveillance', 'Economic Theory', 'Geopolitics',
    'International Relations', 'Legal Reform', 'Philosophy of Mind',
    'Classical Thought', 'Digital Rights', 'Public Policy'
];

const insertTag = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)');
for (const t of tags) {
    insertTag.run(t, t.toLowerCase().replace(/\s+/g, '-'));
}
console.log('Tags seeded.');

// ─── Seed Admin User ───
const passwordHash = bcrypt.hashSync('admin123', 12);
db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run('admin@alexandria.org', passwordHash, 'Admin', 'admin');

// Seed additional users for each role
db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run('editor@alexandria.org', bcrypt.hashSync('editor123', 12), 'Managing Editor', 'managing_editor');

db.prepare('INSERT INTO users (email, password_hash, display_name, role, subject_id) VALUES (?, ?, ?, ?, ?)')
    .run('history@alexandria.org', bcrypt.hashSync('history123', 12), 'Head of History', 'head_of_subject', 1);

db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run('regional@alexandria.org', bcrypt.hashSync('regional123', 12), 'Regional Editor', 'regional_editor');

console.log('Users seeded.');

// ─── Seed Articles ───
const sampleArticles = [
    {
        title: 'The Architecture of Memory: How Ancient Civilizations Preserved Knowledge',
        subtitle: 'From libraries to monasteries, an exploration of knowledge preservation',
        slug: 'architecture-of-memory',
        body: `From the Library of Alexandria to the monasteries of medieval Europe, societies have always sought to preserve and transmit knowledge across generations.\n\nThis exploration examines the physical and philosophical structures that shaped intellectual heritage. The methods by which ancient civilisations stored, categorised, and transmitted knowledge reveal profound insights about how societies understood truth, authority, and the purpose of learning itself.\n\n## The Great Library\n\nThe Library of Alexandria, founded in the third century BCE, represented perhaps the most ambitious attempt in the ancient world to gather the entirety of human knowledge under a single roof. Scholars from across the Mediterranean were drawn to its halls, and the library's acquisition programme was legendary.\n\n## Monastic Traditions\n\nWhen the classical world gave way to the medieval period, the torch of knowledge preservation passed to religious institutions. Monasteries became the primary centres of learning, and monks dedicated their lives to copying and preserving manuscripts.\n\n## Lessons for Today\n\nAs we navigate the digital age, the challenges of knowledge preservation have not disappeared — they have merely transformed. The fragility of digital storage, the ephemerality of online content, and the sheer volume of information produced daily all pose questions that would have been familiar to the librarians of Alexandria.`,
        content_type: 'long_form',
        status: 'published',
        is_global_featured: 1,
        subject_ids: [1],
        author_ids: [1],
        tag_slugs: ['ancient-history', 'classical-thought'],
        seo_description: 'An exploration of how ancient civilisations preserved and transmitted knowledge, from the Library of Alexandria to medieval monasteries.'
    },
    {
        title: 'The Ethics of Artificial Intelligence in Democratic Societies',
        subtitle: 'Grappling with agency, accountability, and justice in the age of AI',
        slug: 'ethics-of-ai-democratic-societies',
        body: `As AI systems become increasingly integrated into governance and decision-making, we must grapple with fundamental questions about agency, accountability, and justice.\n\nThe deployment of algorithmic systems in public administration raises profound ethical questions that democratic societies are only beginning to address. From predictive policing to automated welfare decisions, the intersection of artificial intelligence and democratic governance demands careful scrutiny.\n\n## The Accountability Gap\n\nWhen an algorithm makes a decision that affects a citizen's life, who bears responsibility? The developer? The deploying institution? The elected officials who authorised its use? This accountability gap represents one of the most pressing challenges in contemporary democratic theory.\n\n## Transparency and Trust\n\nDemocratic governance rests on the principle that citizens can understand and challenge the decisions made in their name. Yet many AI systems operate as black boxes, their decision-making processes opaque even to their creators.`,
        content_type: 'long_form',
        status: 'published',
        subject_ids: [5, 2],
        author_ids: [2],
        tag_slugs: ['ai-ethics', 'technology', 'democracy'],
        seo_description: 'Examining the ethical implications of AI systems in democratic governance, from accountability to transparency.'
    },
    {
        title: 'Post-Scarcity Economics: Theory and Reality',
        subtitle: 'The gap between utopian visions and persistent resource challenges',
        slug: 'post-scarcity-economics',
        body: `Examining the gap between utopian visions of abundance and the persistent challenges of resource allocation in the 21st century economy.\n\nThe concept of a post-scarcity society — one in which the fundamental economic problem of limited resources meeting unlimited wants has been resolved — has captivated economists and futurists for generations. But how close are we to this vision, and what obstacles remain?\n\n## Theoretical Foundations\n\nPost-scarcity economics draws on a rich intellectual tradition, from Keynes's prediction of a fifteen-hour work week to more recent arguments about the transformative potential of automation and artificial intelligence.\n\n## The Reality Check\n\nDespite remarkable advances in productivity and technology, scarcity remains a defining feature of economic life for the majority of the world's population. Understanding why requires examining not just productive capacity but the political and institutional structures that govern distribution.`,
        content_type: 'long_form',
        status: 'published',
        subject_ids: [4],
        author_ids: [3],
        tag_slugs: ['economic-theory', 'public-policy'],
        seo_description: 'Examining post-scarcity economics: the gap between utopian abundance and real-world resource allocation challenges.'
    },
    {
        title: 'Digital Privacy in the Age of Surveillance Capitalism',
        subtitle: 'How legal frameworks are evolving in response to data monetisation',
        slug: 'digital-privacy-surveillance-capitalism',
        body: `How legal frameworks are evolving — or failing to evolve — in response to unprecedented data collection and monetisation practices.\n\nThe commodification of personal data has created a new economic paradigm that challenges existing legal frameworks across jurisdictions. As corporations develop ever more sophisticated methods of tracking, profiling, and predicting human behaviour, the law struggles to keep pace.\n\n## The Regulatory Landscape\n\nThe European Union's General Data Protection Regulation represented a landmark attempt to reassert individual control over personal data. Yet even this ambitious framework has proven insufficient in many respects.\n\n## Corporate Resistance\n\nTechnology companies have deployed a range of strategies to resist meaningful regulation, from aggressive lobbying to the strategic deployment of self-regulatory frameworks designed to pre-empt legislative action.`,
        content_type: 'long_form',
        status: 'published',
        subject_ids: [3],
        author_ids: [4],
        tag_slugs: ['data-privacy', 'surveillance', 'digital-rights', 'legal-reform'],
        seo_description: 'Analysis of how legal systems are responding to surveillance capitalism and unprecedented data collection practices.'
    },
    {
        title: 'The New Multilateralism: Power Shifts in the Indo-Pacific',
        subtitle: 'Regional alliances reshaping global governance',
        slug: 'new-multilateralism-indo-pacific',
        body: `Regional alliances are reshaping global governance structures. An analysis of emerging diplomatic frameworks and their implications for international order.\n\nThe Indo-Pacific region has emerged as the primary arena for geopolitical competition in the twenty-first century. As traditional multilateral institutions face questions about their relevance and effectiveness, a new architecture of regional cooperation is taking shape.\n\n## ASEAN and Beyond\n\nThe Association of Southeast Asian Nations has long served as the institutional anchor of regional cooperation. But newer formations — the Quad, AUKUS, and various bilateral partnerships — are reshaping the diplomatic landscape.\n\n## Economic Integration\n\nTrade agreements and economic partnerships are increasingly used as tools of strategic influence. The Regional Comprehensive Economic Partnership and the Comprehensive and Progressive Agreement for Trans-Pacific Partnership represent competing visions of economic integration.`,
        content_type: 'long_form',
        status: 'published',
        subject_ids: [2],
        author_ids: [5],
        tag_slugs: ['geopolitics', 'international-relations'],
        seo_description: 'Analysis of shifting power dynamics and emerging multilateral frameworks in the Indo-Pacific region.'
    },
    {
        title: 'Forgotten Republics: Democratic Experiments Before Athens',
        subtitle: 'Reassessing the origins of collective governance',
        slug: 'forgotten-republics-before-athens',
        body: `Long before the Athenian assembly, communities across the ancient world developed systems of collective governance. A reassessment of democracy's origins.\n\nThe conventional narrative of democracy's birth in fifth-century Athens, while compelling, obscures a far richer and more complex history of collective governance. Across Mesopotamia, the Indian subcontinent, and beyond, communities developed sophisticated systems of shared decision-making long before Cleisthenes's reforms.\n\n## Mesopotamian Assemblies\n\nCuneiform tablets from ancient Sumer describe assemblies of elders and citizens convened to address matters of communal concern. These gatherings, dating to the third millennium BCE, challenge the assumption that democracy was a uniquely Greek invention.\n\n## The Sanghas of Ancient India\n\nThe Buddhist and Jain sanghas of ancient India operated on principles of collective decision-making that bear striking resemblance to democratic governance. Members held equal voting rights, decisions required consensus, and leaders were elected.`,
        content_type: 'long_form',
        status: 'published',
        subject_ids: [1, 2],
        author_ids: [6],
        tag_slugs: ['ancient-history', 'democracy', 'classical-thought'],
        seo_description: 'Exploring democratic governance systems that predated Athens, from Mesopotamian assemblies to Indian sanghas.'
    },
    {
        title: 'Three Signals from This Week’s Parliamentary Coalition Talks',
        subtitle: 'A rapid read on fiscal discipline, cabinet architecture, and foreign-policy coordination.',
        slug: 'signals-from-parliamentary-coalition-talks',
        body: `Coalition negotiators left this week’s talks with fewer public statements but clearer priorities.\n\nFirst, all blocs now acknowledge that debt-service costs will constrain discretionary spending next quarter. Second, committee leadership is being treated as a bargaining chip for policy concessions rather than ceremonial balance. Third, foreign-policy language has narrowed around alliance continuity, reducing uncertainty for markets.\n\nTaken together, these signals suggest a narrower but more predictable governing agenda over the next six months.`,
        content_type: 'short_form',
        status: 'published',
        subject_ids: [2],
        author_ids: [5],
        tag_slugs: ['public-policy', 'geopolitics'],
        seo_description: 'Short-form analysis of coalition negotiations and their implications for fiscal policy and governance.'
    },
    {
        title: 'Court Watch: A Narrow Ruling with Wide Regulatory Consequences',
        subtitle: 'Why one procedural decision may reshape enforcement strategy this year.',
        slug: 'court-watch-narrow-ruling-wide-consequences',
        body: `A procedural ruling issued this morning looks narrow on paper, but agencies are already adjusting how they sequence enforcement actions.\n\nBy emphasizing evidentiary timing over substantive doctrine, the court has effectively raised the cost of early-stage intervention for regulators. Policy teams should expect more targeted actions, fewer broad test cases, and heavier reliance on negotiated compliance frameworks.\n\nFor practitioners, the practical takeaway is immediate: legal strategy will increasingly begin with process design, not just doctrinal argument.`,
        content_type: 'short_form',
        status: 'published',
        subject_ids: [3, 2],
        author_ids: [4],
        tag_slugs: ['legal-reform', 'public-policy', 'democracy'],
        seo_description: 'Short-form briefing on a procedural court ruling and the likely impact on regulatory enforcement.'
    },
];

const insertArticle = db.prepare(`
    INSERT INTO articles (title, subtitle, slug, body, content_type, status, publish_date, is_global_featured, seo_description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const insertArticleSubject = db.prepare('INSERT INTO article_subjects (article_id, subject_id) VALUES (?, ?)');
const insertArticleAuthor = db.prepare('INSERT INTO article_authors (article_id, author_id, is_primary, sort_order) VALUES (?, ?, ?, ?)');
const insertArticleTag = db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)');
const getTagBySlug = db.prepare('SELECT id FROM tags WHERE slug = ?');

const seedArticles = db.transaction(() => {
    let dayOffset = 0;
    for (const a of sampleArticles) {
        const publishDate = new Date(2026, 1, 12 - dayOffset * 2).toISOString();
        dayOffset++;
        
        const result = insertArticle.run(
            a.title, a.subtitle, a.slug, a.body, a.content_type,
            a.status, publishDate, a.is_global_featured || 0,
            a.seo_description || null
        );
        const articleId = result.lastInsertRowid;

        for (const subjectId of a.subject_ids) {
            insertArticleSubject.run(articleId, subjectId);
        }

        a.author_ids.forEach((authorId, i) => {
            insertArticleAuthor.run(articleId, authorId, i === 0 ? 1 : 0, i);
        });

        for (const tagSlug of (a.tag_slugs || [])) {
            const tag = getTagBySlug.get(tagSlug);
            if (tag) insertArticleTag.run(articleId, tag.id);
        }
    }
});

seedArticles();
console.log('Articles seeded.');

db.close();
console.log('\n✓ Database seeded successfully!');
console.log('  Admin login: admin@alexandria.org / admin123');
console.log('  Editor login: editor@alexandria.org / editor123');
console.log('  Run: npm start');
