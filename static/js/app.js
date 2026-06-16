// BigQuery Release Notes - Core JavaScript Application Logic

// Application State
let allUpdates = [];       // Flat list of parsed individual updates
let selectedUpdates = [];  // Currently selected update objects
let currentFilters = {
    search: '',
    type: 'All',
    sort: 'newest' // newest or oldest
};

// DOM Elements
const btnRefresh = document.getElementById('btn-refresh');
const btnRetry = document.getElementById('btn-retry');
const btnClearAll = document.getElementById('btn-clear-all');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const typeFilters = document.getElementById('type-filters');
const sortSelect = document.getElementById('sort-select');
const feedGrid = document.getElementById('feed-grid');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const lastUpdatedText = document.getElementById('last-updated');

// Stats Counters
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statChanges = document.getElementById('stat-changes');
const statDeprecated = document.getElementById('stat-deprecated');
const statOthers = document.getElementById('stat-others');
const statsDashboard = document.getElementById('stats-dashboard');

// Floating Action Bar Elements
const floatingBar = document.getElementById('floating-bar');
const selectedCountText = document.getElementById('selected-count');
const btnClearSelection = document.getElementById('btn-clear-selection');
const btnTweetSelected = document.getElementById('btn-tweet-selected');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const tweetLinkPreview = document.getElementById('tweet-link-preview');
const btnCopyTweet = document.getElementById('btn-copy-tweet');
const copyBtnText = document.getElementById('copy-btn-text');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const btnPublishTweet = document.getElementById('btn-publish-tweet');
const toast = document.getElementById('toast');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    btnRefresh.addEventListener('click', () => fetchNotes(true));
    btnRetry.addEventListener('click', () => fetchNotes(true));
    btnClearAll.addEventListener('click', resetFilters);
    
    // Search Listener with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearSearchBtn.style.display = val ? 'block' : 'none';
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = val.toLowerCase().trim();
            filterAndSortUpdates();
        }, 150);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        currentFilters.search = '';
        filterAndSortUpdates();
        searchInput.focus();
    });

    // Filter Pills Listener
    typeFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
            e.target.classList.add('active');
            currentFilters.type = e.target.dataset.type;
            filterAndSortUpdates();
        }
    });

    // Stat Cards filtering shortcut
    statsDashboard.addEventListener('click', (e) => {
        const statCard = e.target.closest('.stat-card');
        if (statCard) {
            const filterType = statCard.dataset.filter;
            // Activate corresponding filter pill
            const pill = document.querySelector(`.filter-pill[data-type="${filterType}"]`);
            if (pill) {
                pill.click();
            }
        }
    });

    // Sort Selector Listener
    sortSelect.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        filterAndSortUpdates();
    });

    // Selection & Floating Bar Listeners
    btnClearSelection.addEventListener('click', clearSelection);
    btnTweetSelected.addEventListener('click', () => openTweetComposer(selectedUpdates));

    // Modal Listeners
    btnCloseModal.addEventListener('click', closeComposer);
    btnCancelModal.addEventListener('click', closeComposer);
    btnPublishTweet.addEventListener('click', publishTweet);
    btnCopyTweet.addEventListener('click', copyTweetText);
    
    tweetTextarea.addEventListener('input', () => {
        const len = tweetTextarea.value.length;
        charCounter.textContent = 280 - len;
        
        // Counter colors
        charCounter.classList.remove('warning', 'danger');
        if (len >= 260 && len < 280) {
            charCounter.classList.add('warning');
        } else if (len >= 280) {
            charCounter.classList.add('danger');
        }
    });

    // Load Notes
    fetchNotes();
});

// Fetch Release Notes from API
async function fetchNotes(force = false) {
    showState('loading');
    btnRefresh.classList.add('loading');
    
    try {
        const url = force ? '/api/notes?force=true' : '/api/notes';
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            processFeedData(data.entries);
            
            // Format Last Updated Text
            const now = new Date();
            lastUpdatedText.textContent = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            
            if (allUpdates.length === 0) {
                showState('empty');
            } else {
                showState('feed');
                filterAndSortUpdates();
            }
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch (err) {
        console.error('Error fetching release notes:', err);
        document.getElementById('error-message').textContent = err.message || 'Could not connect to the server.';
        showState('error');
    } finally {
        btnRefresh.classList.remove('loading');
    }
}

// Process XML feed entries and split them into individual updates
function processFeedData(entries) {
    allUpdates = [];
    clearSelection();
    
    entries.forEach(entry => {
        const parsed = parseEntryContent(entry);
        allUpdates.push(...parsed);
    });
    
    // Update Stats counters
    updateStats();
}

// Parse HTML contents of an entry and split by <h3> elements
function parseEntryContent(entry) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/html');
    const children = Array.from(doc.body.children);
    
    const updates = [];
    
    // If feed entry doesn't contain H3 headers, treat the entire body as a general update
    const hasH3 = doc.querySelector('h3') !== null;
    
    if (!hasH3) {
        // Classify type based on keywords in title, if any
        let entryType = 'Other';
        const titleLower = entry.title.toLowerCase();
        if (titleLower.includes('feature')) entryType = 'Feature';
        else if (titleLower.includes('change')) entryType = 'Change';
        else if (titleLower.includes('deprecat')) entryType = 'Deprecated';

        updates.push({
            id: entry.id || `gen-${Math.random().toString(36).substr(2, 9)}`,
            date: entry.title,
            isoDate: entry.updated,
            link: entry.link,
            type: entryType,
            html: entry.content
        });
        return updates;
    }
    
    let currentType = '';
    let currentHtml = '';
    let updateCounter = 0;
    
    children.forEach(child => {
        if (child.tagName === 'H3') {
            // Push previous accumulated update
            if (currentHtml.trim()) {
                updates.push({
                    id: `${entry.id || 'entry'}-${updateCounter++}`,
                    date: entry.title,
                    isoDate: entry.updated,
                    link: entry.link,
                    type: currentType || 'Other',
                    html: currentHtml
                });
            }
            currentType = child.textContent.trim();
            currentHtml = '';
        } else {
            currentHtml += child.outerHTML;
        }
    });
    
    // Push final accumulated update
    if (currentHtml.trim()) {
        updates.push({
            id: `${entry.id || 'entry'}-${updateCounter++}`,
            date: entry.title,
            isoDate: entry.updated,
            link: entry.link,
            type: currentType || 'Other',
            html: currentHtml
        });
    }
    
    return updates;
}

// Calculate total statistics and update counters on top of page
function updateStats() {
    let total = allUpdates.length;
    let features = 0;
    let changes = 0;
    let deprecated = 0;
    let others = 0;
    
    allUpdates.forEach(item => {
        const type = normalizeType(item.type);
        if (type === 'Feature') features++;
        else if (type === 'Change') changes++;
        else if (type === 'Deprecated') deprecated++;
        else others++;
    });
    
    statTotal.textContent = total;
    statFeatures.textContent = features;
    statChanges.textContent = changes;
    statDeprecated.textContent = deprecated;
    statOthers.textContent = others;
}

// Helper to normalize H3 text into standardized filter categories
function normalizeType(typeString) {
    const lower = typeString.toLowerCase().trim();
    if (lower.includes('feature')) return 'Feature';
    if (lower.includes('change')) return 'Change';
    if (lower.includes('deprecat')) return 'Deprecated';
    return 'Other';
}

// Filter and Sort Updates, and render them
function filterAndSortUpdates() {
    let filtered = [...allUpdates];
    
    // 1. Text Filter
    if (currentFilters.search) {
        filtered = filtered.filter(item => {
            // Strip HTML tags for clean text search
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.html;
            const textContent = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();
            const dateContent = item.date.toLowerCase();
            const typeContent = item.type.toLowerCase();
            
            return textContent.includes(currentFilters.search) || 
                   dateContent.includes(currentFilters.search) || 
                   typeContent.includes(currentFilters.search);
        });
    }
    
    // 2. Type Filter
    if (currentFilters.type !== 'All') {
        filtered = filtered.filter(item => normalizeType(item.type) === currentFilters.type);
    }
    
    // 3. Sort
    filtered.sort((a, b) => {
        const dateA = new Date(a.isoDate);
        const dateB = new Date(b.isoDate);
        return currentFilters.sort === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    // Render
    renderGrid(filtered);
}

// Render cards list inside the grid container
function renderGrid(updates) {
    feedGrid.innerHTML = '';
    
    if (updates.length === 0) {
        showState('empty');
        return;
    }
    
    showState('feed');
    
    updates.forEach(item => {
        const isSelected = selectedUpdates.some(s => s.id === item.id);
        const cardTypeClass = `badge-${normalizeType(item.type).toLowerCase()}`;
        
        const card = document.createElement('div');
        card.className = `update-card ${isSelected ? 'selected' : ''}`;
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <div class="card-header">
                <span class="update-date">${item.date}</span>
                <span class="badge ${cardTypeClass}">${item.type}</span>
            </div>
            <div class="card-body">
                ${item.html}
            </div>
            <div class="card-footer">
                <a href="${item.link}" target="_blank" class="doc-link" title="Open source docs">
                    <span>Source Notes</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
                <button class="btn btn-secondary btn-small btn-card-tweet" title="Compose a Tweet about this update">
                    <svg class="x-logo-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                </button>
            </div>
        `;
        
        // Single Card Tweet click event propagation handler
        const btnTweet = card.querySelector('.btn-card-tweet');
        btnTweet.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid selecting card when clicking tweet button
            openTweetComposer([item]);
        });
        
        // Select Card toggle click handler
        card.addEventListener('click', () => {
            toggleCardSelection(item, card);
        });
        
        feedGrid.appendChild(card);
    });
}

// Toggle selection state for a card
function toggleCardSelection(item, cardElement) {
    const index = selectedUpdates.findIndex(s => s.id === item.id);
    
    if (index === -1) {
        selectedUpdates.push(item);
        cardElement.classList.add('selected');
    } else {
        selectedUpdates.splice(index, 1);
        cardElement.classList.remove('selected');
    }
    
    handleSelectionChange();
}

// Manage bottom floating selection action bar
function handleSelectionChange() {
    const count = selectedUpdates.length;
    selectedCountText.textContent = count;
    
    if (count > 0) {
        floatingBar.classList.add('active');
    } else {
        floatingBar.classList.remove('active');
    }
}

// Clear all active selection
function clearSelection() {
    selectedUpdates = [];
    document.querySelectorAll('.update-card').forEach(card => card.classList.remove('selected'));
    handleSelectionChange();
}

// Reset all search values and filters
function resetFilters() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    currentFilters.search = '';
    currentFilters.type = 'All';
    currentFilters.sort = 'newest';
    sortSelect.value = 'newest';
    
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.type === 'All');
    });
    
    filterAndSortUpdates();
}

// Compose Tweet draft and open modal dialog
function openTweetComposer(updatesList) {
    if (updatesList.length === 0) return;
    
    const feedLink = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml";
    const hashtag = "#BigQuery";
    
    // We append the link and hashtag separately at the bottom.
    // In X / Twitter, the links count as 23 characters regardless of length,
    // but in standard character counts, let's keep it safe.
    const urlAndHashtag = `\n\nNotes: ${feedLink} ${hashtag}`;
    const maxContentLen = 280 - urlAndHashtag.length; // Max characters available for note text
    
    let draftText = "";
    
    if (updatesList.length === 1) {
        const item = updatesList[0];
        const plainText = stripHtml(item.html);
        draftText = `BigQuery Update (${item.date})\n[${item.type.toUpperCase()}] ${plainText}`;
    } else {
        draftText = `BigQuery Updates:\n`;
        updatesList.forEach((item, idx) => {
            const plainText = stripHtml(item.html);
            draftText += `${idx + 1}. [${item.type}] ${plainText}\n`;
        });
    }
    
    // Trim multiple whitespace spacing
    draftText = draftText.replace(/\s+/g, ' ').trim();
    
    // Ensure draftText content falls under length limits, append ellipses if trimmed
    if (draftText.length > maxContentLen) {
        draftText = draftText.substring(0, maxContentLen - 4) + "...";
    }
    
    const fullTweetDraft = draftText + urlAndHashtag;
    
    // Populating modal elements
    tweetTextarea.value = fullTweetDraft;
    charCounter.textContent = 280 - fullTweetDraft.length;
    tweetLinkPreview.textContent = feedLink;
    
    // Reset copy button state
    copyBtnText.textContent = "Copy Text";
    btnCopyTweet.querySelector('.copy-icon').setAttribute('stroke', 'currentColor');
    
    // Display Modal
    tweetModal.classList.add('active');
}

// Helper to strip tags from HTML text
function stripHtml(htmlStr) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlStr;
    
    // Replaces list items with spaces to avoid words joining together
    const listItems = tempDiv.querySelectorAll('li');
    listItems.forEach(li => {
        li.textContent = ` • ${li.textContent} `;
    });
    
    return tempDiv.textContent || tempDiv.innerText || "";
}

// Close Tweet Modal composer dialog
function closeComposer() {
    tweetModal.classList.remove('active');
}

// Open X / Twitter intent with drafted text
function publishTweet() {
    const text = tweetTextarea.value;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    closeComposer();
}

// Copy draft tweet to user clipboard
function copyTweetText() {
    const text = tweetTextarea.value;
    navigator.clipboard.writeText(text).then(() => {
        // UI Feedback
        copyBtnText.textContent = "Copied!";
        showToast("Copied to clipboard!");
        
        setTimeout(() => {
            copyBtnText.textContent = "Copy Text";
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Show small toast notification popup
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 2500);
}

// State Helper: toggle skeleton loader/errors/grid
function showState(stateName) {
    loadingState.style.display = stateName === 'loading' ? 'block' : 'none';
    errorState.style.display = stateName === 'error' ? 'block' : 'none';
    emptyState.style.display = stateName === 'empty' ? 'block' : 'none';
    feedGrid.style.display = stateName === 'feed' ? 'grid' : 'none';
}
