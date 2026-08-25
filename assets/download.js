/**
 * LGRx Soil Moisture Network — CSV Data Download Module
 * University of Michigan | CYGNSS Ground Validation Network
 */

// ==========================================================================
// CONFIGURATION: ThingSpeak Channel IDs & Read API Keys
// Replace "REPLACE_WITH_KEYX" with your actual ThingSpeak Read API key if required.
// Public channels work automatically even if the key remains default.
// ==========================================================================
const CONFIG = {
    NODE_INFO: {
        "1": { channel: "2996904", readKey: "REPLACE_WITH_KEY1" },
        "2": { channel: "2996908", readKey: "REPLACE_WITH_KEY2" },
        "3": { channel: "2996910", readKey: "REPLACE_WITH_KEY3" },
        "4": { channel: "2996911", readKey: "REPLACE_WITH_KEY4" }
    }
};

/**
 * Formats a ISO local/UTC datetime input into ThingSpeak API format (YYYY-MM-DD%20HH:MM:SS)
 */
function formatDateForAPI(datetimeStr, tz) {
    if (!datetimeStr) return '';
    var date;
    if (tz === 'local') {
        date = new Date(datetimeStr);
    } else if (tz === 'UTC') {
        date = new Date(datetimeStr + 'Z');
    } else {
        date = new Date(datetimeStr + tz);
    }
    if (isNaN(date.getTime())) return '';
    return encodeURIComponent(date.toISOString().replace('T', ' ').slice(0, 19));
}

/**
 * Fetches raw CSV data for a specific node from ThingSpeak
 */
function fetchCsv(node, start, end) {
    var info = CONFIG.NODE_INFO[node];
    if (!info) {
        return Promise.reject(new Error(`Invalid node selection: ${node}`));
    }
    
    var url = `https://api.thingspeak.com/channels/${info.channel}/feeds.csv?start=${start}&end=${end}`;
    if (info.readKey && info.readKey !== '' && !info.readKey.startsWith('REPLACE_WITH_KEY')) {
        url += `&api_key=${info.readKey}`;
    }

    return fetch(url).then(function(resp) {
        if (!resp.ok) {
            throw new Error(`ThingSpeak API error for Node ${node} (HTTP ${resp.status})`);
        }
        return resp.text();
    });
}

/**
 * Parses raw CSV into structured objects with node-specific column re-labeling
 */
function parseCsv(text, node) {
    var lines = text.trim().split(/\r?\n/);
    if (lines.length === 0 || text.trim() === '') return { headers: [], rows: {} };

    var original = lines[0].split(',');
    var headers = [];
    var indices = [];

    for (var i = 0; i < original.length; i++) {
        var h = original[i].replace(/^"|"$/g, '').trim();
        if (h === 'field1') continue; // drop unused field1
        if (h === 'field2') {
            headers.push('node' + node + '_SMRaw');
        } else if (h === 'field3') {
            headers.push('node' + node + '_TempC');
        } else if (h === 'field4') {
            headers.push('node' + node + '_BVolts');
        } else if (h === 'field5') {
            headers.push('node' + node + '_RSSI');
        } else if (h === 'field6') {
            headers.push('node' + node + '_SNR');
        } else {
            headers.push(h);
        }
        indices.push(i);
    }

    var rows = {};
    for (var r = 1; r < lines.length; r++) {
        if (!lines[r].trim()) continue;
        var parts = lines[r].split(',');
        var row = {};
        for (var j = 0; j < headers.length; j++) {
            var idx = indices[j];
            row[headers[j]] = parts[idx] ? parts[idx].replace(/^"|"$/g, '').trim() : '';
        }
        if (row.created_at) {
            rows[row.created_at] = row;
        }
    }
    return { headers: headers, rows: rows };
}

function csvFromParsed(parsed) {
    var lines = [parsed.headers.join(',')];
    Object.keys(parsed.rows).forEach(function(ts) {
        var row = parsed.rows[ts];
        var parts = parsed.headers.map(function(h) { return row[h] || ''; });
        lines.push(parts.join(','));
    });
    return lines.join('\n');
}

/**
 * Merges multi-node parsed CSV results into a single aligned dataset on timestamp
 */
function combineCsv(results) {
    var timestamps = new Set();
    results.forEach(function(r) {
        Object.keys(r.data.rows).forEach(function(ts) { timestamps.add(ts); });
    });
    var sorted = Array.from(timestamps).sort();

    var header = ['timestamp'];
    results.forEach(function(res) {
        res.data.headers.forEach(function(h) {
            if (h === 'created_at' || h === 'entry_id') return;
            header.push(h);
        });
    });

    var rows = sorted.map(function(ts) {
        var parts = [ts];
        results.forEach(function(res) {
            res.data.headers.forEach(function(h) {
                if (h === 'created_at' || h === 'entry_id') return;
                var row = res.data.rows[ts];
                parts.push(row ? (row[h] || '') : '');
            });
        });
        return parts.join(',');
    });

    return header.join('\n') + '\n' + rows.join('\n');
}

function setStatusMessage(msg, type) {
    var statusEl = document.getElementById('download-status');
    if (!statusEl) return;
    statusEl.className = 'download-status ' + (type || 'info');
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
}

function clearStatusMessage() {
    var statusEl = document.getElementById('download-status');
    if (!statusEl) return;
    statusEl.style.display = 'none';
}

function triggerDownload(csvContent, filename) {
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Initializes the Download Form listener
 */
function initDownloadForm() {
    var form = document.getElementById('download-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        var node = document.getElementById('node-select').value;
        var startIn = document.getElementById('start').value;
        var endIn = document.getElementById('end').value;
        var tz = document.getElementById('timezone-select').value;

        if (!startIn || !endIn) {
            setStatusMessage('Please select both Start and End date/time.', 'error');
            return;
        }

        var start = formatDateForAPI(startIn, tz);
        var end = formatDateForAPI(endIn, tz);

        if (!start || !end) {
            setStatusMessage('Invalid date format selected.', 'error');
            return;
        }

        setStatusMessage('Connecting to ThingSpeak API and generating CSV...', 'info');

        if (node === 'all') {
            var nodes = Object.keys(CONFIG.NODE_INFO);
            Promise.all(nodes.map(function(n) {
                return fetchCsv(n, start, end).then(function(csv) {
                    return { node: n, data: parseCsv(csv, n) };
                });
            })).then(function(results) {
                var combined = combineCsv(results);
                var filename = `LGRx_All_Nodes_${startIn.slice(0, 10)}_to_${endIn.slice(0, 10)}.csv`;
                triggerDownload(combined, filename);
                setStatusMessage(`Download successful! Downloaded combined dataset for all 4 nodes.`, 'success');
            }).catch(function(err) {
                console.error('Download failed:', err);
                setStatusMessage(`Download error: ${err.message}. If channels require read keys, please add your keys in assets/download.js.`, 'error');
            });
        } else if (CONFIG.NODE_INFO[node]) {
            fetchCsv(node, start, end)
                .then(function(csv) {
                    var parsed = parseCsv(csv, node);
                    var outputCsv = csvFromParsed(parsed);
                    var filename = `LGRx_Node_${node}_Data_${startIn.slice(0, 10)}_to_${endIn.slice(0, 10)}.csv`;
                    triggerDownload(outputCsv, filename);
                    setStatusMessage(`Download successful! Downloaded Node ${node} dataset.`, 'success');
                })
                .catch(function(err) {
                    console.error('Download failed:', err);
                    setStatusMessage(`Download error: ${err.message}. If channel requires a read key, please add your key in assets/download.js.`, 'error');
                });
        }
    });
}

document.addEventListener('DOMContentLoaded', initDownloadForm);
