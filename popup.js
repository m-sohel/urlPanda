/**
 * urlPanda - Modern Chrome Extension Popup Script
 * Features: Folders, Search & Filters, Edit Links, Tags & Notes,
 * Duplicate Detection, Reading List, Backup & Restore, Better Link Management.
 */

// ============================================================================
// Core Logic & Utilities (Testable & Reusable)
// ============================================================================

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? ':' + parsed.port : ''}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map(t => String(t).trim().toLowerCase())
      .filter(t => t.length > 0)
      .filter((t, i, arr) => arr.indexOf(t) === i);
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
      .filter((t, i, arr) => arr.indexOf(t) === i);
  }
  return [];
}

function normalizeLink(item) {
  if (!item || typeof item !== 'object') return null;
  const rawUrl = typeof item.url === 'string' ? item.url.trim() : '';
  if (!rawUrl) return null;

  const validStatuses = ['unread', 'in-progress', 'completed'];
  const status = validStatuses.includes(item.status) ? item.status : 'unread';

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `lnk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    url: rawUrl,
    title: (typeof item.title === 'string' && item.title.trim()) ? item.title.trim() : rawUrl,
    folder: (typeof item.folder === 'string' && item.folder.trim()) ? item.folder.trim() : 'General',
    tags: normalizeTags(item.tags),
    notes: typeof item.notes === 'string' ? item.notes.trim() : '',
    status: status,
    createdAt: typeof item.createdAt === 'number' && !isNaN(item.createdAt) ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === 'number' && !isNaN(item.updatedAt) ? item.updatedAt : Date.now()
  };
}

function findDuplicateLink(links, url, ignoreId = null) {
  if (!url || !Array.isArray(links)) return null;
  const target = normalizeUrl(url);
  return links.find(l => {
    if (ignoreId && l.id === ignoreId) return false;
    return normalizeUrl(l.url) === target;
  }) || null;
}

function filterAndSortLinks(links, filters = {}) {
  const {
    search = '',
    folder = 'all',
    status = 'all',
    tag = 'all',
    sortBy = 'newest'
  } = filters;

  const searchLower = (search || '').trim().toLowerCase();

  let filtered = links.filter(link => {
    // Search match: title, url, notes, or tags
    if (searchLower) {
      const matchTitle = link.title && link.title.toLowerCase().includes(searchLower);
      const matchUrl = link.url && link.url.toLowerCase().includes(searchLower);
      const matchNotes = link.notes && link.notes.toLowerCase().includes(searchLower);
      const matchTag = Array.isArray(link.tags) && link.tags.some(t => t.toLowerCase().includes(searchLower));
      if (!matchTitle && !matchUrl && !matchNotes && !matchTag) {
        return false;
      }
    }

    // Folder filter
    if (folder && folder !== 'all') {
      if ((link.folder || 'General').toLowerCase() !== folder.toLowerCase()) {
        return false;
      }
    }

    // Status filter
    if (status && status !== 'all') {
      if (link.status !== status) {
        return false;
      }
    }

    // Tag filter
    if (tag && tag !== 'all') {
      const tagLower = tag.toLowerCase();
      if (!Array.isArray(link.tags) || !link.tags.includes(tagLower)) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return (a.createdAt || 0) - (b.createdAt || 0);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' });
      case 'domain-asc': {
        const domainA = getDomain(a.url || '');
        const domainB = getDomain(b.url || '');
        return domainA.localeCompare(domainB, undefined, { sensitivity: 'base' });
      }
      case 'newest':
      default:
        return (b.createdAt || 0) - (a.createdAt || 0);
    }
  });

  return filtered;
}

function createFolder(folders, folderName) {
  const name = (folderName || '').trim();
  if (!name) {
    throw new Error('Folder name cannot be empty.');
  }
  const exists = folders.some(f => f.toLowerCase() === name.toLowerCase());
  if (exists) {
    throw new Error(`A folder named "${name}" already exists.`);
  }
  return [...folders, name];
}

function renameFolder(folders, links, oldName, newName) {
  const trimmedNew = (newName || '').trim();
  if (!trimmedNew) {
    throw new Error('Folder name cannot be empty.');
  }
  if (oldName.toLowerCase() === 'general') {
    throw new Error('The default "General" folder cannot be renamed.');
  }
  const exists = folders.some(f => f.toLowerCase() === trimmedNew.toLowerCase() && f.toLowerCase() !== oldName.toLowerCase());
  if (exists) {
    throw new Error(`A folder named "${trimmedNew}" already exists.`);
  }

  const updatedFolders = folders.map(f => (f.toLowerCase() === oldName.toLowerCase() ? trimmedNew : f));
  const updatedLinks = links.map(l => {
    if ((l.folder || 'General').toLowerCase() === oldName.toLowerCase()) {
      return { ...l, folder: trimmedNew, updatedAt: Date.now() };
    }
    return l;
  });

  return { folders: updatedFolders, links: updatedLinks };
}

function deleteFolder(folders, links, folderToDelete) {
  if (folderToDelete.toLowerCase() === 'general') {
    throw new Error('The default "General" folder cannot be deleted.');
  }
  const updatedFolders = folders.filter(f => f.toLowerCase() !== folderToDelete.toLowerCase());
  const updatedLinks = links.map(l => {
    if ((l.folder || 'General').toLowerCase() === folderToDelete.toLowerCase()) {
      return { ...l, folder: 'General', updatedAt: Date.now() };
    }
    return l;
  });

  return { folders: updatedFolders, links: updatedLinks };
}

function prepareExportData(folders, links) {
  return {
    app: 'urlPanda',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: Array.from(new Set(folders)),
    links: links.map(normalizeLink).filter(Boolean)
  };
}

function parseAndValidateImportData(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format: ' + err.message);
  }

  if (!parsed) {
    throw new Error('Import data is empty.');
  }

  let importedLinks = [];
  let importedFolders = [];

  if (Array.isArray(parsed)) {
    importedLinks = parsed;
  } else if (typeof parsed === 'object') {
    if (Array.isArray(parsed.links)) {
      importedLinks = parsed.links;
    }
    if (Array.isArray(parsed.folders)) {
      importedFolders = parsed.folders.map(f => String(f).trim()).filter(Boolean);
    }
  } else {
    throw new Error('Invalid backup file format.');
  }

  const validLinks = importedLinks.map(normalizeLink).filter(Boolean);

  if (validLinks.length === 0 && importedFolders.length === 0) {
    throw new Error('No valid links or folders found in the imported file.');
  }

  return { folders: importedFolders, links: validLinks };
}

function mergeImportedData(currentFolders, currentLinks, importedData, strategy = 'skip') {
  const newFolders = Array.from(new Set([...currentFolders, ...importedData.folders]));

  let updatedLinks = [...currentLinks];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const impLink of importedData.links) {
    const existingIndex = updatedLinks.findIndex(l => normalizeUrl(l.url) === normalizeUrl(impLink.url));

    if (existingIndex !== -1) {
      if (strategy === 'skip') {
        skippedCount++;
      } else if (strategy === 'overwrite') {
        const existing = updatedLinks[existingIndex];
        updatedLinks[existingIndex] = {
          ...impLink,
          id: existing.id,
          createdAt: existing.createdAt || impLink.createdAt,
          updatedAt: Date.now()
        };
        updatedCount++;
      } else if (strategy === 'keep-both') {
        updatedLinks.push({
          ...impLink,
          id: `lnk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          updatedAt: Date.now()
        });
        addedCount++;
      }
    } else {
      updatedLinks.push(impLink);
      addedCount++;
    }

    if (impLink.folder && !newFolders.includes(impLink.folder)) {
      newFolders.push(impLink.folder);
    }
  }

  return {
    folders: newFolders,
    links: updatedLinks,
    stats: {
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: importedData.links.length
    }
  };
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor((now - date) / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `${Math.floor(diffHours)}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ============================================================================
// UI & Extension Lifecycle (Runs in Browser Context)
// ============================================================================

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const DEFAULT_FOLDERS = ['General', 'Development', 'Learning', 'Projects', 'Personal'];

    const state = {
      links: [],
      folders: [...DEFAULT_FOLDERS],
      currentTab: null,
      filters: {
        search: '',
        folder: 'all',
        status: 'all',
        tag: 'all',
        sortBy: 'newest'
      },
      pendingSave: null,
      editingLinkId: null,
      deletingLinkId: null,
      importedFileContent: null
    };

    // --- DOM Elements ---
    const totalCountBadge = document.getElementById('total-count-badge');
    const linksList = document.getElementById('links-list');
    const emptyState = document.getElementById('empty-state');
    const emptyIcon = document.getElementById('empty-icon');
    const emptyTitle = document.getElementById('empty-title');
    const emptyMessage = document.getElementById('empty-message');
    const emptyActionBtn = document.getElementById('empty-action-btn');
    const toastContainer = document.getElementById('toast-container');

    // Quick Save
    const saveLinkForm = document.getElementById('save-link-form');
    const saveTitleInput = document.getElementById('save-title-input');
    const saveFolderSelect = document.getElementById('save-folder-select');
    const saveStatusSelect = document.getElementById('save-status-select');
    const saveTagsInput = document.getElementById('save-tags-input');
    const saveNotesInput = document.getElementById('save-notes-input');
    const toggleSaveDetailsBtn = document.getElementById('toggle-save-details');
    const saveDetailsContainer = document.getElementById('save-details-container');
    const saveToggleIcon = document.getElementById('save-toggle-icon');
    const saveToggleText = document.getElementById('save-toggle-text');

    // Search and Filters
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterFolderSelect = document.getElementById('filter-folder-select');
    const filterStatusSelect = document.getElementById('filter-status-select');
    const sortSelect = document.getElementById('sort-select');
    const tagFilterBar = document.getElementById('tag-filter-bar');
    const tagChipsWrapper = document.getElementById('tag-chips-wrapper');
    const resultsCountText = document.getElementById('results-count-text');
    const btnResetFilters = document.getElementById('btn-reset-filters');

    // Modals
    const editModal = document.getElementById('edit-modal');
    const editLinkForm = document.getElementById('edit-link-form');
    const editLinkId = document.getElementById('edit-link-id');
    const editTitleInput = document.getElementById('edit-title-input');
    const editUrlInput = document.getElementById('edit-url-input');
    const editFolderSelect = document.getElementById('edit-folder-select');
    const editStatusSelect = document.getElementById('edit-status-select');
    const editTagsInput = document.getElementById('edit-tags-input');
    const editNotesInput = document.getElementById('edit-notes-input');

    const foldersModal = document.getElementById('folders-modal');
    const btnOpenFolders = document.getElementById('btn-open-folders');
    const createFolderForm = document.getElementById('create-folder-form');
    const newFolderInput = document.getElementById('new-folder-input');
    const modalFoldersList = document.getElementById('modal-folders-list');

    const backupModal = document.getElementById('backup-modal');
    const btnOpenBackup = document.getElementById('btn-open-backup');
    const btnExportJson = document.getElementById('btn-export-json');
    const importFileInput = document.getElementById('import-file-input');
    const importStrategySelect = document.getElementById('import-strategy-select');
    const btnExecuteImport = document.getElementById('btn-execute-import');
    const importFeedbackBox = document.getElementById('import-feedback-box');

    const duplicateModal = document.getElementById('duplicate-modal');
    const dupPreviewTitle = document.getElementById('dup-preview-title');
    const dupPreviewUrl = document.getElementById('dup-preview-url');
    const dupPreviewFolder = document.getElementById('dup-preview-folder');
    const dupPreviewStatus = document.getElementById('dup-preview-status');
    const btnDupOpen = document.getElementById('btn-dup-open');
    const btnDupSaveAnyway = document.getElementById('btn-dup-save-anyway');

    const deleteModal = document.getElementById('delete-modal');
    const delPreviewTitle = document.getElementById('del-preview-title');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');

    // --- Toast Notifications ---
    const showToast = (message, duration = 2500) => {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease';
        setTimeout(() => toast.remove(), 200);
      }, duration);
    };

    // --- Modal Management ---
    const openModal = (modalEl) => {
      modalEl.classList.remove('hidden');
    };

    const closeModal = (modalEl) => {
      modalEl.classList.add('hidden');
    };

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close');
        const modal = document.getElementById(targetId);
        if (modal) closeModal(modal);
      });
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        [editModal, foldersModal, backupModal, duplicateModal, deleteModal].forEach(m => {
          if (!m.classList.contains('hidden')) closeModal(m);
        });
      }
    });

    // --- Storage Sync ---
    const saveStateToStorage = (callback) => {
      chrome.storage.local.set({
        links: state.links,
        folders: state.folders
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving storage:', chrome.runtime.lastError);
          showToast('⚠️ Failed to save changes locally.');
        } else {
          if (callback) callback();
        }
      });
    };

    const loadData = () => {
      chrome.storage.local.get({ links: [], folders: [] }, (result) => {
        // Normalize links
        const rawLinks = Array.isArray(result.links) ? result.links : [];
        state.links = rawLinks.map(normalizeLink).filter(Boolean);

        // Normalize folders
        let storedFolders = Array.isArray(result.folders) && result.folders.length > 0
          ? result.folders.map(f => String(f).trim()).filter(Boolean)
          : [...DEFAULT_FOLDERS];

        if (!storedFolders.some(f => f.toLowerCase() === 'general')) {
          storedFolders.unshift('General');
        }

        // Incorporate any folders from links that aren't listed
        state.links.forEach(l => {
          if (l.folder && !storedFolders.some(f => f.toLowerCase() === l.folder.toLowerCase())) {
            storedFolders.push(l.folder);
          }
        });

        // Unique
        const seen = new Set();
        state.folders = storedFolders.filter(f => {
          const lower = f.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });

        // Check if migration occurred and save if so
        saveStateToStorage(() => {
          updateFolderSelects();
          renderLinks();
        });
      });
    };

    // --- Update Folder Dropdowns ---
    const updateFolderSelects = () => {
      const folderCounts = {};
      state.folders.forEach(f => { folderCounts[f.toLowerCase()] = 0; });
      state.links.forEach(l => {
        const key = (l.folder || 'General').toLowerCase();
        folderCounts[key] = (folderCounts[key] || 0) + 1;
      });

      // 1. Save Folder Select
      saveFolderSelect.innerHTML = '';
      state.folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (state.filters.folder !== 'all' && state.filters.folder.toLowerCase() === f.toLowerCase()) {
          opt.selected = true;
        } else if (f.toLowerCase() === 'general' && state.filters.folder === 'all') {
          opt.selected = true;
        }
        saveFolderSelect.appendChild(opt);
      });

      // 2. Edit Folder Select
      editFolderSelect.innerHTML = '';
      state.folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        editFolderSelect.appendChild(opt);
      });

      // 3. Filter Folder Select
      const currentSelectedFolder = state.filters.folder;
      filterFolderSelect.innerHTML = '';
      
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = `📁 All Folders (${state.links.length})`;
      filterFolderSelect.appendChild(allOpt);

      state.folders.forEach(f => {
        const count = folderCounts[f.toLowerCase()] || 0;
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = `📁 ${f} (${count})`;
        if (currentSelectedFolder.toLowerCase() === f.toLowerCase()) {
          opt.selected = true;
        }
        filterFolderSelect.appendChild(opt);
      });

      // 4. Modal Folders List
      renderModalFoldersList(folderCounts);
    };

    // --- Render Folders Manager List in Modal ---
    const renderModalFoldersList = (folderCounts = {}) => {
      modalFoldersList.innerHTML = '';

      state.folders.forEach(folder => {
        const isGeneral = folder.toLowerCase() === 'general';
        const count = folderCounts[folder.toLowerCase()] || 
          state.links.filter(l => (l.folder || 'General').toLowerCase() === folder.toLowerCase()).length;

        const li = document.createElement('li');
        li.className = 'folder-manage-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'folder-item-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'folder-item-name';
        nameSpan.textContent = `📁 ${folder}`;

        const countBadge = document.createElement('span');
        countBadge.className = 'folder-item-count';
        countBadge.textContent = `${count} ${count === 1 ? 'link' : 'links'}`;

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(countBadge);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'folder-item-actions';

        if (!isGeneral) {
          // Rename Button
          const renameBtn = document.createElement('button');
          renameBtn.type = 'button';
          renameBtn.className = 'btn-action-icon';
          renameBtn.title = 'Rename folder';
          renameBtn.textContent = '✏️';
          renameBtn.addEventListener('click', () => handleRenameFolder(folder));

          // Delete Button
          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'btn-action-icon btn-delete';
          deleteBtn.title = 'Delete folder';
          deleteBtn.textContent = '🗑️';
          deleteBtn.addEventListener('click', () => handleDeleteFolder(folder, count));

          actionsDiv.appendChild(renameBtn);
          actionsDiv.appendChild(deleteBtn);
        }

        li.appendChild(infoDiv);
        li.appendChild(actionsDiv);
        modalFoldersList.appendChild(li);
      });
    };

    // --- Folder CRUD Handlers ---
    createFolderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = newFolderInput.value.trim();
      if (!name) return;

      try {
        state.folders = createFolder(state.folders, name);
        saveStateToStorage(() => {
          newFolderInput.value = '';
          updateFolderSelects();
          showToast(`📁 Folder "${name}" created!`);
        });
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    });

    const handleRenameFolder = (oldName) => {
      const newName = prompt(`Rename folder "${oldName}" to:`, oldName);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed.toLowerCase() === oldName.toLowerCase()) return;

      try {
        const result = renameFolder(state.folders, state.links, oldName, trimmed);
        state.folders = result.folders;
        state.links = result.links;

        if (state.filters.folder.toLowerCase() === oldName.toLowerCase()) {
          state.filters.folder = trimmed;
        }

        saveStateToStorage(() => {
          updateFolderSelects();
          renderLinks();
          showToast(`📁 Renamed to "${trimmed}"!`);
        });
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    };

    const handleDeleteFolder = (folderName, linkCount) => {
      const confirmMsg = linkCount > 0
        ? `Are you sure you want to delete folder "${folderName}"?\nIts ${linkCount} ${linkCount === 1 ? 'link' : 'links'} will be moved to "General".`
        : `Delete empty folder "${folderName}"?`;

      if (!confirm(confirmMsg)) return;

      try {
        const result = deleteFolder(state.folders, state.links, folderName);
        state.folders = result.folders;
        state.links = result.links;

        if (state.filters.folder.toLowerCase() === folderName.toLowerCase()) {
          state.filters.folder = 'all';
        }

        saveStateToStorage(() => {
          updateFolderSelects();
          renderLinks();
          showToast(`🗑️ Folder "${folderName}" deleted.`);
        });
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    };

    // --- Active Tab Detection ---
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        state.currentTab = tabs[0];
        if (state.currentTab.title && !saveTitleInput.value) {
          saveTitleInput.value = state.currentTab.title;
        }
      }
    });

    // --- Toggle Save Details Panel ---
    toggleSaveDetailsBtn.addEventListener('click', () => {
      const isHidden = saveDetailsContainer.classList.contains('hidden');
      if (isHidden) {
        saveDetailsContainer.classList.remove('hidden');
        toggleSaveDetailsBtn.setAttribute('aria-expanded', 'true');
        saveToggleIcon.textContent = '▾';
        saveToggleText.textContent = 'Fewer details';
      } else {
        saveDetailsContainer.classList.add('hidden');
        toggleSaveDetailsBtn.setAttribute('aria-expanded', 'false');
        saveToggleIcon.textContent = '▸';
        saveToggleText.textContent = 'Add details (folder, tags, notes)';
      }
    });

    // --- Save Tab Form Submission ---
    saveLinkForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!state.currentTab || !state.currentTab.url) {
        showToast('⚠️ No active web page detected to save.');
        return;
      }

      const rawUrl = state.currentTab.url;
      // Disallow chrome://, edge://, about: URLs
      if (rawUrl.startsWith('chrome://') || rawUrl.startsWith('edge://') || rawUrl.startsWith('about:') || rawUrl.startsWith('chrome-extension://')) {
        showToast('⚠️ Browser internal pages cannot be saved.');
        return;
      }

      const customTitle = saveTitleInput.value.trim();
      const title = customTitle || state.currentTab.title || rawUrl;
      const folder = saveFolderSelect.value || 'General';
      const status = saveStatusSelect.value || 'unread';
      const tags = normalizeTags(saveTagsInput.value);
      const notes = saveNotesInput.value.trim();

      const newLinkObj = {
        url: rawUrl,
        title: title,
        folder: folder,
        status: status,
        tags: tags,
        notes: notes
      };

      // Check for duplicates
      const duplicate = findDuplicateLink(state.links, rawUrl);
      if (duplicate) {
        state.pendingSave = newLinkObj;
        dupPreviewTitle.textContent = duplicate.title;
        dupPreviewUrl.textContent = duplicate.url;
        dupPreviewFolder.textContent = `📁 ${duplicate.folder || 'General'}`;
        dupPreviewStatus.textContent = getStatusLabel(duplicate.status);
        dupPreviewStatus.className = `status-badge status-${duplicate.status}`;

        btnDupOpen.onclick = () => {
          chrome.tabs.create({ url: duplicate.url });
          closeModal(duplicateModal);
        };

        btnDupSaveAnyway.onclick = () => {
          commitSaveLink(state.pendingSave);
          closeModal(duplicateModal);
        };

        openModal(duplicateModal);
        return;
      }

      // No duplicate, commit save directly
      commitSaveLink(newLinkObj);
    });

    const commitSaveLink = (linkData) => {
      const link = normalizeLink(linkData);
      if (!link) return;

      state.links.unshift(link);

      saveStateToStorage(() => {
        saveTitleInput.value = '';
        saveTagsInput.value = '';
        saveNotesInput.value = '';
        updateFolderSelects();
        renderLinks();
        showToast(`✅ Saved to "${link.folder}"!`);
      });
    };

    // --- Search & Filters Event Listeners ---
    searchInput.addEventListener('input', () => {
      state.filters.search = searchInput.value;
      if (searchInput.value.trim()) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
      renderLinks();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.filters.search = '';
      clearSearchBtn.classList.add('hidden');
      searchInput.focus();
      renderLinks();
    });

    filterFolderSelect.addEventListener('change', () => {
      state.filters.folder = filterFolderSelect.value;
      renderLinks();
    });

    filterStatusSelect.addEventListener('change', () => {
      state.filters.status = filterStatusSelect.value;
      renderLinks();
    });

    sortSelect.addEventListener('change', () => {
      state.filters.sortBy = sortSelect.value;
      renderLinks();
    });

    btnResetFilters.addEventListener('click', () => {
      resetFilters();
    });

    emptyActionBtn.addEventListener('click', () => {
      resetFilters();
    });

    const resetFilters = () => {
      state.filters.search = '';
      state.filters.folder = 'all';
      state.filters.status = 'all';
      state.filters.tag = 'all';
      state.filters.sortBy = 'newest';

      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      filterFolderSelect.value = 'all';
      filterStatusSelect.value = 'all';
      sortSelect.value = 'newest';

      renderLinks();
    };

    // --- Tag Bar Rendering ---
    const updateTagFilterBar = () => {
      const allTags = new Set();
      state.links.forEach(l => {
        if (Array.isArray(l.tags)) {
          l.tags.forEach(t => allTags.add(t));
        }
      });

      if (allTags.size === 0) {
        tagFilterBar.classList.add('hidden');
        return;
      }

      tagFilterBar.classList.remove('hidden');
      tagChipsWrapper.innerHTML = '';

      const allChip = document.createElement('span');
      allChip.className = `tag-pill ${state.filters.tag === 'all' ? 'active' : ''}`;
      allChip.textContent = 'All Tags';
      allChip.addEventListener('click', () => {
        state.filters.tag = 'all';
        renderLinks();
      });
      tagChipsWrapper.appendChild(allChip);

      Array.from(allTags).sort().forEach(tag => {
        const chip = document.createElement('span');
        chip.className = `tag-pill ${state.filters.tag === tag ? 'active' : ''}`;
        chip.textContent = `#${tag}`;
        chip.addEventListener('click', () => {
          state.filters.tag = state.filters.tag === tag ? 'all' : tag;
          renderLinks();
        });
        tagChipsWrapper.appendChild(chip);
      });
    };

    // --- Reading Status Helper ---
    const getStatusLabel = (status) => {
      switch (status) {
        case 'in-progress': return '🟡 In Progress';
        case 'completed': return '🟢 Completed';
        case 'unread':
        default:
          return '⚪ Unread';
      }
    };

    const cycleStatus = (currentStatus) => {
      if (currentStatus === 'unread') return 'in-progress';
      if (currentStatus === 'in-progress') return 'completed';
      return 'unread';
    };

    // --- Render Links List ---
    const renderLinks = () => {
      totalCountBadge.textContent = `${state.links.length} ${state.links.length === 1 ? 'link' : 'links'}`;

      const filteredLinks = filterAndSortLinks(state.links, state.filters);
      linksList.innerHTML = '';

      // Check if any filter is active
      const isFiltered = state.filters.search.trim() !== '' ||
        state.filters.folder !== 'all' ||
        state.filters.status !== 'all' ||
        state.filters.tag !== 'all';

      // Results Bar update
      if (isFiltered) {
        resultsCountText.textContent = `Showing ${filteredLinks.length} of ${state.links.length} links`;
        btnResetFilters.classList.remove('hidden');
      } else {
        resultsCountText.textContent = `Showing all ${state.links.length} links`;
        btnResetFilters.classList.add('hidden');
      }

      updateTagFilterBar();

      // Empty State
      if (filteredLinks.length === 0) {
        emptyState.classList.remove('hidden');
        if (state.links.length === 0) {
          emptyIcon.textContent = '🐼';
          emptyTitle.textContent = 'No links saved yet';
          emptyMessage.textContent = 'Click "Save Tab" above to start building your personal library.';
          emptyActionBtn.classList.add('hidden');
        } else {
          emptyIcon.textContent = '🔍';
          emptyTitle.textContent = 'No matching links found';
          emptyMessage.textContent = 'Try adjusting your search query, folder filter, or tag selection.';
          emptyActionBtn.classList.remove('hidden');
        }
        return;
      }

      emptyState.classList.add('hidden');

      // Build Link Cards
      filteredLinks.forEach(link => {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.setAttribute('role', 'listitem');
        card.id = `link-${link.id}`;

        // Top Header
        const header = document.createElement('div');
        header.className = 'link-card-header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'link-title-group';

        const favicon = document.createElement('img');
        favicon.className = 'link-favicon';
        const domain = getDomain(link.url);
        favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
        favicon.alt = '';
        favicon.loading = 'lazy';
        favicon.onerror = () => {
          favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="%2364748b"><circle cx="8" cy="8" r="7" stroke="%2394a3b8" stroke-width="1.5" fill="none"/><path d="M1 8h14M8 1a10 10 0 0 1 0 14 10 10 0 0 1 0-14z"/></svg>';
        };

        const anchor = document.createElement('a');
        anchor.className = 'link-title-anchor';
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.title;
        anchor.title = `${link.title}\n${link.url}`;

        titleGroup.appendChild(favicon);
        titleGroup.appendChild(anchor);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'link-card-actions';

        // Copy URL
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-action-icon';
        copyBtn.title = 'Copy URL';
        copyBtn.setAttribute('aria-label', 'Copy URL');
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(link.url).then(() => {
            showToast('📋 Copied to clipboard!');
          }).catch(() => {
            showToast('⚠️ Unable to copy');
          });
        });

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-action-icon';
        editBtn.title = 'Edit link details';
        editBtn.setAttribute('aria-label', 'Edit link');
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleOpenEditModal(link);
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-action-icon btn-delete';
        deleteBtn.title = 'Delete link';
        deleteBtn.setAttribute('aria-label', 'Delete link');
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleOpenDeleteModal(link);
        });

        actions.appendChild(copyBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        header.appendChild(titleGroup);
        header.appendChild(actions);

        // Meta Row (Domain, Folder, Status, Date)
        const meta = document.createElement('div');
        meta.className = 'link-card-meta';

        const domainSpan = document.createElement('span');
        domainSpan.className = 'link-domain';
        domainSpan.textContent = domain;

        const folderBadge = document.createElement('span');
        folderBadge.className = 'folder-badge';
        folderBadge.textContent = `📁 ${link.folder || 'General'}`;
        folderBadge.title = 'Folder';

        // Clickable Reading Status Badge
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge status-${link.status}`;
        statusBadge.textContent = getStatusLabel(link.status);
        statusBadge.title = 'Click to cycle reading status (Unread → In Progress → Completed)';
        statusBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextStatus = cycleStatus(link.status);
          link.status = nextStatus;
          link.updatedAt = Date.now();
          saveStateToStorage(() => {
            renderLinks();
            showToast(`Status: ${getStatusLabel(nextStatus)}`);
          });
        });

        const dateSpan = document.createElement('span');
        dateSpan.className = 'link-date';
        dateSpan.textContent = formatDate(link.createdAt);

        meta.appendChild(domainSpan);
        meta.appendChild(folderBadge);
        meta.appendChild(statusBadge);
        meta.appendChild(dateSpan);

        card.appendChild(header);
        card.appendChild(meta);

        // Tags Row
        if (Array.isArray(link.tags) && link.tags.length > 0) {
          const tagsContainer = document.createElement('div');
          tagsContainer.className = 'link-card-tags';

          link.tags.forEach(tag => {
            const tagChip = document.createElement('span');
            tagChip.className = 'tag-pill';
            tagChip.textContent = `#${tag}`;
            tagChip.title = `Filter by #${tag}`;
            tagChip.addEventListener('click', (e) => {
              e.stopPropagation();
              state.filters.tag = tag;
              renderLinks();
            });
            tagsContainer.appendChild(tagChip);
          });

          card.appendChild(tagsContainer);
        }

        // Notes Row
        if (link.notes && link.notes.trim()) {
          const noteBox = document.createElement('div');
          noteBox.className = 'link-card-note';
          noteBox.textContent = `📝 ${link.notes}`;
          card.appendChild(noteBox);
        }

        linksList.appendChild(card);
      });
    };

    // --- Edit Link Modal Handlers ---
    const handleOpenEditModal = (link) => {
      state.editingLinkId = link.id;
      editLinkId.value = link.id;
      editTitleInput.value = link.title;
      editUrlInput.value = link.url;
      editFolderSelect.value = link.folder || 'General';
      editStatusSelect.value = link.status || 'unread';
      editTagsInput.value = (link.tags || []).join(', ');
      editNotesInput.value = link.notes || '';

      openModal(editModal);
    };

    editLinkForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = editLinkId.value;
      const targetLink = state.links.find(l => l.id === id);
      if (!targetLink) return;

      const newTitle = editTitleInput.value.trim();
      const newUrl = editUrlInput.value.trim();
      const newFolder = editFolderSelect.value || 'General';
      const newStatus = editStatusSelect.value || 'unread';
      const newTags = normalizeTags(editTagsInput.value);
      const newNotes = editNotesInput.value.trim();

      if (!newTitle) {
        showToast('⚠️ Title cannot be empty.');
        return;
      }
      if (!newUrl) {
        showToast('⚠️ URL cannot be empty.');
        return;
      }

      // Check duplicate URL against other links
      const duplicate = findDuplicateLink(state.links, newUrl, id);
      if (duplicate) {
        showToast(`⚠️ Another saved link already uses this URL: "${duplicate.title}"`);
        return;
      }

      targetLink.title = newTitle;
      targetLink.url = newUrl;
      targetLink.folder = newFolder;
      targetLink.status = newStatus;
      targetLink.tags = newTags;
      targetLink.notes = newNotes;
      targetLink.updatedAt = Date.now();

      saveStateToStorage(() => {
        closeModal(editModal);
        updateFolderSelects();
        renderLinks();
        showToast('✅ Link updated successfully!');
      });
    });

    // --- Delete Confirmation Modal Handlers ---
    const handleOpenDeleteModal = (link) => {
      state.deletingLinkId = link.id;
      delPreviewTitle.textContent = link.title;
      openModal(deleteModal);
    };

    btnConfirmDelete.addEventListener('click', () => {
      if (!state.deletingLinkId) return;

      const index = state.links.findIndex(l => l.id === state.deletingLinkId);
      if (index !== -1) {
        const deleted = state.links.splice(index, 1)[0];
        saveStateToStorage(() => {
          closeModal(deleteModal);
          state.deletingLinkId = null;
          updateFolderSelects();
          renderLinks();
          showToast(`🗑️ "${deleted.title}" deleted.`);
        });
      } else {
        closeModal(deleteModal);
      }
    });

    // --- Header Modal Triggers ---
    btnOpenFolders.addEventListener('click', () => {
      updateFolderSelects();
      openModal(foldersModal);
    });

    btnOpenBackup.addEventListener('click', () => {
      importFeedbackBox.classList.add('hidden');
      importFileInput.value = '';
      btnExecuteImport.disabled = true;
      state.importedFileContent = null;
      openModal(backupModal);
    });

    // --- Backup & Restore Handlers ---
    btnExportJson.addEventListener('click', () => {
      try {
        const exportObj = prepareExportData(state.folders, state.links);
        const jsonString = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `urlpanda-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('💾 Backup file exported successfully!');
      } catch (err) {
        showToast(`⚠️ Export failed: ${err.message}`);
      }
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        btnExecuteImport.disabled = true;
        state.importedFileContent = null;
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        state.importedFileContent = event.target.result;
        btnExecuteImport.disabled = false;
        importFeedbackBox.classList.remove('hidden');
        importFeedbackBox.className = 'feedback-box';
        importFeedbackBox.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB). Click "Import Backup File" below to proceed.`;
      };
      reader.onerror = () => {
        btnExecuteImport.disabled = true;
        importFeedbackBox.classList.remove('hidden');
        importFeedbackBox.className = 'feedback-box error';
        importFeedbackBox.textContent = 'Failed to read file.';
      };
      reader.readAsText(file);
    });

    btnExecuteImport.addEventListener('click', () => {
      if (!state.importedFileContent) return;

      try {
        const validated = parseAndValidateImportData(state.importedFileContent);
        const strategy = importStrategySelect.value || 'skip';

        const result = mergeImportedData(state.folders, state.links, validated, strategy);
        state.folders = result.folders;
        state.links = result.links;

        saveStateToStorage(() => {
          updateFolderSelects();
          renderLinks();

          const { added, updated, skipped } = result.stats;
          const msg = `Import complete: ${added} added, ${updated} updated, ${skipped} skipped.`;
          importFeedbackBox.className = 'feedback-box success';
          importFeedbackBox.textContent = msg;
          showToast(`📥 ${msg}`);
          btnExecuteImport.disabled = true;
        });
      } catch (err) {
        importFeedbackBox.className = 'feedback-box error';
        importFeedbackBox.textContent = `Import error: ${err.message}`;
        showToast(`⚠️ Import error: ${err.message}`);
      }
    });

    // --- Init ---
    loadData();
  });
}

// ============================================================================
// Module Export for Node Unit Tests
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
