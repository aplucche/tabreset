import { pipeline, env } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');

const MODEL_ID = 'onnx-community/LFM2-350M-ONNX';
const DB_NAME = 'tabreset-db';
const STORE_NAME = 'file-handles';
const FILE_HANDLE_KEY = 'outputFile';

// DOM Elements
const statusText = document.getElementById('status-text');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const fileSection = document.getElementById('file-section');
const fileStatus = document.getElementById('file-status');
const filePath = document.getElementById('file-path');
const openFileBtn = document.getElementById('open-file-btn');
const newFileBtn = document.getElementById('new-file-btn');
const changeFileBtn = document.getElementById('change-file-btn');
const runBtn = document.getElementById('run-btn');
const logArea = document.getElementById('log');

let fileHandle = null;
let summarizer = null;

// IndexedDB helpers for persisting file handle
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
    });
}

async function saveFileHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, FILE_HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadFileHandle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(FILE_HANDLE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function log(msg) {
    logArea.textContent += msg + '\n';
    logArea.scrollTop = logArea.scrollHeight;
}

function setStatus(msg, progress = null) {
    statusText.textContent = msg;
    if (progress !== null && progress > 0) {
        progressBarContainer.classList.remove('hidden');
        progressBar.style.width = `${progress}%`;
    } else {
        progressBarContainer.classList.add('hidden');
        progressBar.style.width = '0%';
    }
}

function updateFileUI() {
    if (fileHandle) {
        fileStatus.classList.add('hidden');
        filePath.classList.remove('hidden');
        filePath.textContent = fileHandle.name;
        openFileBtn.classList.add('hidden');
        newFileBtn.classList.add('hidden');
        changeFileBtn.classList.remove('hidden');
    } else {
        fileStatus.classList.remove('hidden');
        filePath.classList.add('hidden');
        openFileBtn.classList.remove('hidden');
        newFileBtn.classList.remove('hidden');
        changeFileBtn.classList.add('hidden');
    }
    checkReady();
}

// Initialize Model
async function initModel() {
    try {
        setStatus('Loading model...');

        summarizer = await pipeline('text-generation', MODEL_ID, {
            dtype: 'fp32',
            progress_callback: (data) => {
                if (data.status === 'progress' && data.progress > 0) {
                    setStatus(`Loading model... ${Math.round(data.progress)}%`, data.progress);
                }
            }
        });

        setStatus('Model ready.');
        log('Model loaded successfully.');
        checkReady();
    } catch (err) {
        console.error(err);
        setStatus('Error loading model: ' + err.message);
        log('Error: ' + err.message);
    }
}

// Try to restore saved file handle
async function restoreFileHandle() {
    try {
        const savedHandle = await loadFileHandle();
        if (savedHandle) {
            // Verify we still have permission
            const permission = await savedHandle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                fileHandle = savedHandle;
                updateFileUI();
                log(`Restored file: ${fileHandle.name}`);
            } else if (permission === 'prompt') {
                // Store handle but will need to request permission on first use
                fileHandle = savedHandle;
                updateFileUI();
                log(`File available: ${fileHandle.name} (will request permission)`);
            }
        }
    } catch (err) {
        console.error('Could not restore file handle:', err);
    }
}

// File Handling
async function openExistingFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'Markdown File',
                accept: { 'text/markdown': ['.md'] },
            }],
        });
        fileHandle = handle;
        await saveFileHandle(fileHandle);
        updateFileUI();
        log(`Opened: ${fileHandle.name}`);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            log('Error opening file: ' + err.message);
        }
    }
}

async function createNewFile() {
    try {
        fileHandle = await window.showSaveFilePicker({
            suggestedName: 'tabreset.md',
            types: [{
                description: 'Markdown File',
                accept: { 'text/markdown': ['.md'] },
            }],
        });
        await saveFileHandle(fileHandle);
        updateFileUI();
        log(`Created: ${fileHandle.name}`);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            log('Error creating file: ' + err.message);
        }
    }
}

function checkReady() {
    if (summarizer && fileHandle) {
        runBtn.disabled = false;
    } else {
        runBtn.disabled = true;
    }
}

// Content Extraction - optimized for speed
function extractPageContent() {
    // Try meta description first (fastest, usually good summary)
    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    const ogDesc = document.querySelector('meta[property="og:description"]')?.content;

    if (metaDesc && metaDesc.length > 50) {
        return { type: 'meta', content: metaDesc };
    }
    if (ogDesc && ogDesc.length > 50) {
        return { type: 'meta', content: ogDesc };
    }

    // Try to find article content
    const article = document.querySelector('article');
    if (article) {
        const text = article.innerText.trim();
        if (text.length > 100) {
            return { type: 'article', content: text.slice(0, 2000) };
        }
    }

    // Fall back to main content area or body
    const main = document.querySelector('main') || document.body;

    // Get text content, filtering out scripts/styles
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let text = '';
    let node;
    while ((node = walker.nextNode()) && text.length < 2500) {
        const parent = node.parentElement;
        if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
            const chunk = node.textContent.trim();
            if (chunk.length > 0) {
                text += chunk + ' ';
            }
        }
    }

    return { type: 'body', content: text.trim().slice(0, 2000) };
}

// Append a single row to the file
async function appendToFile(content) {
    // Request permission if needed
    const permission = await fileHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
        const requestResult = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (requestResult !== 'granted') {
            throw new Error('File permission denied');
        }
    }

    const file = await fileHandle.getFile();
    const existingContent = await file.text();

    let newContent = existingContent;

    // Add header if file is empty
    if (!existingContent.trim()) {
        newContent = '| Title | Summary | Link | Closed |\n|---|---|---|---|\n';
    }

    newContent += content;

    const writable = await fileHandle.createWritable();
    await writable.write(newContent);
    await writable.close();
}

// Main Logic
async function run() {
    runBtn.disabled = true;
    openFileBtn.disabled = true;
    newFileBtn.disabled = true;
    changeFileBtn.disabled = true;

    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const validTabs = tabs.filter(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));

        log(`Found ${validTabs.length} tabs to process.`);

        let processedCount = 0;

        for (let i = 0; i < validTabs.length; i++) {
            const tab = validTabs[i];
            const shortTitle = tab.title.length > 25 ? tab.title.slice(0, 25) + '...' : tab.title;
            setStatus(`Processing ${i + 1}/${validTabs.length}: ${shortTitle}`);

            try {
                // Extract content
                const [{ result }] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: extractPageContent,
                });

                if (!result || !result.content || result.content.length < 30) {
                    log(`Skipping ${shortTitle} (no content)`);
                    continue;
                }

                // Generate summary based on content type
                let summary;
                if (result.type === 'meta') {
                    // Meta descriptions are already summaries, use directly
                    summary = result.content;
                } else {
                    // Generate summary for longer content
                    const prompt = `Summarize in one sentence:\n${result.content.slice(0, 1500)}\n\nSummary:`;

                    const summaryOutput = await summarizer(prompt, {
                        max_new_tokens: 50,
                        min_new_tokens: 10,
                        do_sample: false,
                        return_full_text: false
                    });

                    summary = summaryOutput[0]?.generated_text?.trim() || "No summary generated";
                }

                // Format row
                const dateStr = new Date().toLocaleString();
                const row = `| ${tab.title.replace(/\|/g, '-').replace(/\n/g, ' ')} | ${summary.replace(/\|/g, '-').replace(/\n/g, ' ')} | [Link](${tab.url}) | ${dateStr} |\n`;

                // Write to file immediately
                await appendToFile(row);
                log(`Saved: ${shortTitle}`);

                // Close tab immediately after writing
                await chrome.tabs.remove(tab.id);
                processedCount++;

            } catch (err) {
                console.error(`Error processing tab ${tab.id}:`, err);
                log(`Error: ${shortTitle} - ${err.message}`);
            }
        }

        setStatus(`Done! Processed ${processedCount} tabs.`);
        log('All operations completed.');

    } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message);
        log('Critical Error: ' + err.message);
    } finally {
        runBtn.disabled = false;
        openFileBtn.disabled = false;
        newFileBtn.disabled = false;
        changeFileBtn.disabled = false;
        checkReady();
    }
}

// Event Listeners
openFileBtn.addEventListener('click', openExistingFile);
newFileBtn.addEventListener('click', createNewFile);
changeFileBtn.addEventListener('click', openExistingFile);
runBtn.addEventListener('click', run);

// Start
restoreFileHandle();
initModel();
