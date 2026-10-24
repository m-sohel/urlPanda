// Test popup.js exported functions directly
const {
  normalizeUrl,
  getDomain,
  normalizeTags,
  normalizeLink,
  findDuplicateLink,
  filterAndSortLinks,
  createFolder,
  renameFolder,
  deleteFolder,
  prepareExportData,
  parseAndValidateImportData,
  mergeImportedData,
  formatDate
} = require('../popup.js');

function runTests() {
  const assert = (condition, msg) => {
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ PASS: ${msg}`);
    }
  };

  console.log('--- Testing URL Normalization & Domain ---');
  assert(normalizeUrl('https://example.com/') === 'https://example.com', 'Strips root trailing slash');
  assert(normalizeUrl('HTTPS://EXAMPLE.COM/path/') === 'https://example.com/path', 'Lowercases domain and strips trailing slash');
  assert(normalizeUrl('https://example.com/page?ref=abc#top') === 'https://example.com/page?ref=abc#top', 'Preserves query & hash');
  assert(getDomain('https://www.google.com/search') === 'google.com', 'Strips www from domain');
  assert(getDomain('https://sub.domain.co.uk') === 'sub.domain.co.uk', 'Extracts subdomain properly');

  console.log('--- Testing Tags Normalization ---');
  assert(JSON.stringify(normalizeTags('work, DEV, work, javascript ')) === JSON.stringify(['work', 'dev', 'javascript']), 'Dedupes and lowercases string tags');
  assert(JSON.stringify(normalizeTags(['CSS', '  HTML ', 'css'])) === JSON.stringify(['css', 'html']), 'Dedupes array tags');

  console.log('--- Testing Link Normalization & Migration ---');
  const legacy = { url: 'https://developer.mozilla.org', title: 'MDN Web Docs' };
  const normalized = normalizeLink(legacy);
  assert(normalized.id && normalized.id.startsWith('lnk_'), 'Generated valid ID');
  assert(normalized.folder === 'General', 'Default folder is General');
  assert(normalized.status === 'unread', 'Default status is unread');
  assert(Array.isArray(normalized.tags) && normalized.tags.length === 0, 'Tags initialized as empty array');
  assert(normalized.notes === '', 'Notes initialized as empty string');
  assert(typeof normalized.createdAt === 'number', 'Timestamp added');

  console.log('--- Testing Duplicate Detection ---');
  const links = [
    normalizeLink({ url: 'https://github.com/m-sohel', title: 'Profile' }),
    normalizeLink({ url: 'https://news.ycombinator.com', title: 'Hacker News' })
  ];
  assert(findDuplicateLink(links, 'https://github.com/m-sohel/') !== null, 'Finds duplicate URL with trailing slash');
  assert(findDuplicateLink(links, 'https://news.ycombinator.com') !== null, 'Finds exact duplicate');
  assert(findDuplicateLink(links, 'https://reddit.com') === null, 'Returns null for non-duplicate');
  assert(findDuplicateLink(links, 'https://github.com/m-sohel', links[0].id) === null, 'Ignores self when editing');

  console.log('--- Testing Folders Management ---');
  let folders = ['General', 'Development', 'Projects'];
  folders = createFolder(folders, 'Learning');
  assert(folders.includes('Learning'), 'Added new folder');
  let threwDuplicate = false;
  try {
    createFolder(folders, 'learning');
  } catch {
    threwDuplicate = true;
  }
  assert(threwDuplicate, 'Throws error when creating duplicate folder (case-insensitive)');

  const renamed = renameFolder(folders, [{ url: 'https://test.com', folder: 'Learning' }], 'Learning', 'Education');
  assert(renamed.folders.includes('Education') && !renamed.folders.includes('Learning'), 'Renamed in folders array');
  assert(renamed.links[0].folder === 'Education', 'Updated links belonging to renamed folder');

  const deleted = deleteFolder(renamed.folders, renamed.links, 'Education');
  assert(!deleted.folders.includes('Education'), 'Removed from folder list');
  assert(deleted.links[0].folder === 'General', 'Reassigned links to General');

  console.log('--- Testing Search & Filter & Sort ---');
  const dataset = [
    normalizeLink({ url: 'https://react.dev', title: 'React', folder: 'Development', tags: ['frontend'], status: 'unread', createdAt: 100 }),
    normalizeLink({ url: 'https://nodejs.org', title: 'Node.js', folder: 'Development', tags: ['backend'], status: 'in-progress', createdAt: 200 }),
    normalizeLink({ url: 'https://medium.com/@story', title: 'Great Article', folder: 'Personal', tags: ['reading'], status: 'completed', createdAt: 300, notes: 'Fascinating story on AI' })
  ];

  // Search by note
  const searchNote = filterAndSortLinks(dataset, { search: 'fascinating' });
  assert(searchNote.length === 1 && searchNote[0].title === 'Great Article', 'Found match in notes');

  // Filter by tag
  const filterTag = filterAndSortLinks(dataset, { tag: 'backend' });
  assert(filterTag.length === 1 && filterTag[0].title === 'Node.js', 'Filtered by tag');

  // Filter by reading status
  const filterStatus = filterAndSortLinks(dataset, { status: 'in-progress' });
  assert(filterStatus.length === 1 && filterStatus[0].title === 'Node.js', 'Filtered by reading status');

  // Sort domain asc
  const sortDomain = filterAndSortLinks(dataset, { sortBy: 'domain-asc' });
  assert(sortDomain[0].url.includes('medium.com'), 'Sorted domain asc: medium comes before nodejs/react');

  console.log('--- Testing Backup & Restore ---');
  const backup = prepareExportData(['General', 'Development'], dataset);
  assert(backup.app === 'urlPanda' && backup.version === 1, 'Export metadata verified');
  assert(backup.links.length === 3, 'Export link count verified');

  const jsonStr = JSON.stringify(backup);
  const parsed = parseAndValidateImportData(jsonStr);
  assert(parsed.links.length === 3, 'Import parses backup JSON correctly');

  // Import strategies: skip
  const mergeSkip = mergeImportedData(['General'], dataset, {
    folders: ['NewFolder'],
    links: [
      normalizeLink({ url: 'https://react.dev', title: 'React Duplicate' }),
      normalizeLink({ url: 'https://vitejs.dev', title: 'Vite', folder: 'NewFolder' })
    ]
  }, 'skip');
  assert(mergeSkip.stats.skipped === 1 && mergeSkip.stats.added === 1, 'Skipped duplicate and added new');
  assert(mergeSkip.links.length === 4, 'Links count correctly 4');

  // Import strategies: overwrite
  const mergeOverwrite = mergeImportedData(['General'], dataset, {
    folders: [],
    links: [
      normalizeLink({ url: 'https://react.dev', title: 'React Updated' })
    ]
  }, 'overwrite');
  assert(mergeOverwrite.stats.updated === 1, 'Updated duplicate');
  const updatedLink = mergeOverwrite.links.find(l => l.url === 'https://react.dev');
  assert(updatedLink.title === 'React Updated', 'Link title updated');

  // Date formatting
  assert(typeof formatDate(Date.now()) === 'string', 'Formats recent date');

  console.log('====================================');
  console.log('🎉 ALL TESTS FOR POPUP.JS PASSED!');
  console.log('====================================');
}

runTests();

