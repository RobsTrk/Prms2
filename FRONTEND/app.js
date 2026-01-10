// ==========================================
// PRMS+ FRONTEND LOGIC (INTEGRATED)
// ==========================================

const API_BASE = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
    ? "http://127.0.0.1:8000"
    : ""; // Relative path for Vercel/Production

const currentUser = localStorage.getItem('prms_user');
const currentRole = localStorage.getItem('prms_role'); // 'admin' or 'nurse'

// --- 1. AUTH & INIT ---
if (!currentUser || !currentRole) {
    if (!window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

let patients = [];
let currentPatient = null;
let vitalsChartInstance = null;
let isEmergency = false;
let recognition = null; // Voice Scribe

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('patient-list')) {
        initDashboard();
    }
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.removeEventListener('submit', handleLogin);
        loginForm.addEventListener('submit', handleLogin);
    }
});

function logout() {
    localStorage.removeItem('prms_user');
    localStorage.removeItem('prms_role');
    window.location.href = 'login.html';
}

function initDashboard() {
    // UI Role Setup
    document.body.classList.add(`role-${currentRole}`);
    document.getElementById('user-name').innerText = currentUser;
    document.getElementById('user-role').innerText = currentRole === 'admin' ? 'Physician / Admin' : 'Registered Nurse';
    document.getElementById('user-avatar').innerText = currentRole === 'admin' ? 'DA' : 'RN';

    if (currentRole === 'nurse') {
        const avatar = document.getElementById('user-avatar');
        avatar.className = "w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-900 font-bold border-2 border-white";
    }

    // Voice Setup
    setupVoiceScribe();

    // Data Load
    fetchPatients();
}

async function fetchPatients() {
    try {
        const response = await fetch(`${API_BASE}/patients`);
        if (!response.ok) throw new Error("API Error");
        patients = await response.json();
        renderPatientList();

        // Refresh detail view if open
        if (currentPatient) {
            const updated = patients.find(p => p.id === currentPatient.id);
            if (updated) selectPatient(updated.id);
        }
    } catch (err) {
        console.error(err);
        const listEl = document.getElementById('patient-list');
        if (listEl) listEl.innerHTML = `<p class="text-red-500 p-4 text-xs">🔴 Backend Offline. Ensure 'main.py' is running.</p>`;
    }
}

// --- 2. LOGIN LOGIC ---
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!usernameInput || !passwordInput) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
        });
        if (!res.ok) {
            alert('Invalid Credentials');
            return;
        }

        const data = await res.json();
        localStorage.setItem('prms_user', data.username);
        localStorage.setItem('prms_role', data.role);
        window.location.href = 'index.html';

    } catch (error) {
        alert("Cannot connect to server: " + error.message);
    }
}

// --- 3. RENDERING ---
function renderPatientList() {
    const listContainer = document.getElementById('patient-list');
    listContainer.innerHTML = '';

    const activePatients = patients.filter(p => p.status !== 'Discharged');
    document.getElementById('active-count').innerText = activePatients.length;

    // Sort: Active > Discharged
    const sorted = [...patients].sort((a, b) => {
        if (a.status === 'Discharged' && b.status !== 'Discharged') return 1;
        if (a.status !== 'Discharged' && b.status === 'Discharged') return -1;
        return 0;
    });

    sorted.forEach(p => {
        const isDischarged = p.status === 'Discharged';
        let statusColor = '';
        switch (p.status) {
            case 'Critical': statusColor = 'bg-red-100 text-red-700 border-red-200'; break;
            case 'Stable': statusColor = 'bg-green-100 text-green-700 border-green-200'; break;
            case 'Recovering': statusColor = 'bg-blue-100 text-blue-700 border-blue-200'; break;
            case 'Discharged': statusColor = 'bg-slate-100 text-slate-500 border-slate-200'; break;
            default: statusColor = 'bg-gray-100 text-gray-700';
        }

        const opacity = isDischarged ? 'opacity-60 grayscale bg-slate-50' : 'bg-white';
        const hover = isDischarged ? '' : 'hover:border-medical-600 hover:shadow-md';

        listContainer.innerHTML += `
            <div onclick="selectPatient(${p.id})" class="cursor-pointer p-4 rounded-xl border border-white shadow-sm transition group mb-2 ${opacity} ${hover}">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-bold text-slate-700 ${isDischarged ? '' : 'group-hover:text-medical-700'}">${p.name}</h4>
                    <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusColor}">${p.status}</span>
                </div>
                <div class="flex justify-between text-xs text-slate-500">
                    <span>ID: #${p.id}</span>
                </div>
            </div>
        `;
    });
}

function selectPatient(id) {
    currentPatient = patients.find(p => p.id === id);
    if (!currentPatient) return;

    // Switch to detail view if in dashboard
    const dash = document.getElementById('dashboard-view');
    if (dash && !dash.classList.contains('hidden')) {
        const emptyState = document.getElementById('empty-state');
        const patientDetail = document.getElementById('patient-detail');
        if (emptyState) emptyState.classList.add('hidden');
        if (patientDetail) patientDetail.classList.remove('hidden');
    }

    // Header Info
    const nameEl = document.getElementById('p-name');
    if (nameEl) nameEl.innerText = currentPatient.name || '--';
    const idEl = document.getElementById('p-id');
    if (idEl) idEl.innerText = currentPatient.id || '--';
    const genderEl = document.getElementById('p-gender');
    if (genderEl) genderEl.innerText = currentPatient.gender || '--';
    const dobEl = document.getElementById('p-dob');
    if (dobEl) dobEl.innerText = currentPatient.dob || '--';

    // Status Badge
    const badge = document.getElementById('p-status');
    if (badge) {
        badge.innerText = currentPatient.status || 'Unknown';
        badge.className = `px-2 py-1 text-xs font-bold rounded-full shadow-sm ${currentPatient.status === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    }

    // Components
    renderTimeline(currentPatient.history || []);
    renderChart(currentPatient);
    renderInstructions(currentPatient.instructions || []);

    // Scans
    const scanRecords = (currentPatient.history || []).filter(h => h && (h.type === 'Radiology' || (h.type && h.type.includes('Scan'))));
    renderScans(scanRecords);

    // Clear Inputs
    const nurseNote = document.getElementById('nurse-note');
    if (nurseNote) nurseNote.value = "";
    const updateStatus = document.getElementById('update-status');
    if (updateStatus) updateStatus.value = "";

    // Set discharge date if exists
    const disInput = document.getElementById('nurse-discharge');
    if (disInput && currentPatient.discharge_time && currentPatient.discharge_time !== 'TBD') {
        disInput.value = currentPatient.discharge_time.replace(' ', 'T');
    }
}

function renderTimeline(history) {
    const container = document.getElementById('timeline-container');
    container.innerHTML = '';
    const sorted = [...(history || [])].reverse();

    sorted.forEach(evt => {
        container.innerHTML += `
            <div class="mb-6 ml-6 relative group">
                <span class="absolute -left-[31px] top-1 flex items-center justify-center w-8 h-8 bg-white border-2 border-slate-200 rounded-full group-hover:border-medical-500 transition">
                    <i class="fa-solid ${evt.icon} ${evt.color} text-xs"></i>
                </span>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:shadow-md transition">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-slate-700 text-sm">${evt.type}</span>
                        <span class="text-xs text-slate-400 font-mono">${evt.date}</span>
                    </div>
                    <p class="text-sm text-slate-600 leading-snug">${evt.description}</p>
                </div>
            </div>
        `;
    });
}

function renderInstructions(list) {
    const el = document.getElementById('instructions-list');
    el.innerHTML = list.length ? '' : '<div class="text-xs text-slate-400 italic text-center py-2">No active orders</div>';

    list.forEach(item => {
        const isDone = item.status === 'done';
        const icon = isDone ? 'fa-square-check text-green-500' : 'fa-square text-slate-300';
        const opacity = isDone ? 'opacity-50' : 'opacity-100';
        const click = currentRole === 'nurse' ? `onclick="toggleInstruction(${item.id})"` : '';
        const cursor = currentRole === 'nurse' ? 'cursor-pointer' : '';

        el.innerHTML += `
             <div ${click} class="flex items-start gap-2 p-2 rounded border border-blue-100 bg-white shadow-sm transition ${cursor} ${opacity}">
                <i class="fa-regular ${icon} mt-0.5 text-sm"></i>
                <div class="flex-1">
                    <p class="text-xs text-slate-700 font-medium ${isDone ? 'line-through' : ''}">${item.text}</p>
                    <p class="text-[10px] text-slate-400">By ${item.from} at ${item.time}</p>
                </div>
            </div>
        `;
    });
}

function renderScans(list) {
    const el = document.getElementById('scans-list');
    el.innerHTML = list.length ? '' : '<div class="text-xs text-slate-400 italic text-center py-2">No scans found</div>';

    list.forEach(scan => {
        el.innerHTML += `
            <div class="flex items-center gap-3 p-2 rounded border border-slate-100 bg-white hover:shadow-sm transition group">
                <div class="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                    <i class="fa-solid fa-file-medical"></i>
                </div>
                <div class="flex-1">
                    <p class="text-xs font-bold text-slate-700">Radiology Report</p>
                    <p class="text-[10px] text-slate-400">${scan.date}</p>
                </div>
            </div>
        `;
    });
}

// --- 4. BACKEND ACTIONS ---

// Update Condition / Notes (Includes Voice logic)
async function updatePatientCondition() {
    if (!currentPatient) return;
    const note = document.getElementById('nurse-note')?.value || '';
    const status = document.getElementById('update-status')?.value || '';
    const discharge = document.getElementById('nurse-discharge')?.value || '';

    if (!note && !status && !discharge) return alert("Please enter some info.");

    try {
        // 1. Save Note/History
        if (note || status) {
            const recordRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    type: "Condition Update",
                    description: note ? note : `Status changed to ${status}`,
                    icon: "fa-notes-medical",
                    color: "text-orange-600"
                })
            });
        }

        // 2. Update status/discharge
        const updates = {};
        if (status) updates.status = status;
        if (discharge) updates.discharge_time = discharge.replace('T', ' ');

        if (Object.keys(updates).length > 0) {
            const updateRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        }

        alert("✅ Record Updated");
        const noteEl = document.getElementById('nurse-note');
        if (noteEl) noteEl.value = "";
        const statusEl = document.getElementById('update-status');
        if (statusEl) statusEl.value = "";
        fetchPatients();
    } catch (err) {
        alert("Error updating patient: " + err.message);
    }
}

// Add Vital
async function addVital() {
    const inputEl = document.getElementById('vitals-input');
    const val = inputEl ? parseInt(inputEl.value) : NaN;
    if (!val || !currentPatient) return;

    if (val > 120) alert("⚠️ High HR Alert!");

    try {
        // Update Array & History
        const updateRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vitals_update: val })
        });
        const recordRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: "Vitals",
                description: `HR Recorded: ${val} bpm`,
                icon: "fa-heart-pulse",
                color: "text-blue-500"
            })
        });
        if (inputEl) inputEl.value = "";
        fetchPatients();
    } catch (err) {
        alert("Error adding vital: " + err.message);
    }
}

// Add Patient (Admin)
async function handleAddPatient(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('new-name').value;
    const dob = document.getElementById('new-dob').value;
    const gender = document.getElementById('new-gender').value;
    const status = document.getElementById('new-status').value;

    try {
        await fetch(`${API_BASE}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, dob, gender, status })
        });
        closeAddPatientModal();
        e.target.reset();
        fetchPatients();
    } catch (err) { alert("Error adding patient"); }
}
const addForm = document.getElementById('addPatientForm');
if (addForm) addForm.addEventListener('submit', handleAddPatient);

// Instructions
async function addInstruction() {
    const textEl = document.getElementById('new-order-text');
    const text = textEl ? textEl.value : '';
    if (!text || !currentPatient) return;

    const list = [...(currentPatient.instructions || [])];
    list.push({
        id: Date.now(),
        text: text,
        from: currentUser,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending'
    });

    try {
        const res = await fetch(`${API_BASE}/patients/${currentPatient.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructions_update: list })
        });
        if (res.ok) {
            if (textEl) textEl.value = "";
            fetchPatients();
        } else {
            alert("Error adding instruction");
        }
    } catch (err) {
        alert("Error adding instruction: " + err.message);
    }
}

async function toggleInstruction(id) {
    if (!currentPatient) return;
    const list = [...currentPatient.instructions];
    const item = list.find(i => i.id === id);
    if (item) {
        item.status = item.status === 'done' ? 'pending' : 'done';
        try {
            const res = await fetch(`${API_BASE}/patients/${currentPatient.id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instructions_update: list })
            });
            if (res.ok) {
                fetchPatients();
            }
        } catch (err) {
            console.error('Error toggling instruction:', err);
        }
    }
}

// Scans
async function addScan() {
    if (!currentPatient) return alert("No patient selected");
    const typeEl = document.getElementById('scan-type');
    const dateEl = document.getElementById('scan-date');
    const type = typeEl ? typeEl.value : '';
    const date = dateEl ? dateEl.value : '';
    if (!date) return alert("Select Date");

    try {
        const res = await fetch(`${API_BASE}/patients/${currentPatient.id}/record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: date,
                type: "Radiology",
                description: `${type} report uploaded.`,
                icon: "fa-file-medical",
                color: "text-indigo-600"
            })
        });
        if (res.ok) {
            fetchPatients();
        } else {
            alert("Error adding scan");
        }
    } catch (err) {
        alert("Error adding scan: " + err.message);
    }
}

// Discharge
async function dischargePatient() {
    if (!currentPatient || !confirm("Discharge Patient?")) return;

    try {
        const updateRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: "Discharged",
                discharge_time: new Date().toLocaleTimeString()
            })
        });

        const recordRes = await fetch(`${API_BASE}/patients/${currentPatient.id}/record`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: new Date().toLocaleDateString(),
                type: "Discharge",
                description: "Patient discharged.",
                icon: "fa-door-open",
                color: "text-slate-500"
            })
        });

        if (updateRes.ok && recordRes.ok) {
            alert("Patient Discharged");
            fetchPatients();
        } else {
            alert("Error discharging patient");
        }
    } catch (err) {
        alert("Error discharging patient: " + err.message);
    }
}

// --- 5. UTILS (Chart, Voice, Emergency, Reports) ---

function renderChart(p) {
    const ctx = document.getElementById('vitalsChart').getContext('2d');
    if (vitalsChartInstance) vitalsChartInstance.destroy();

    const data = (p.vitals_history && p.vitals_history.length) ? p.vitals_history : [72, 75, 74];
    const isCrit = p.status === 'Critical';

    vitalsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i + 1),
            datasets: [{
                label: 'HR',
                data: data,
                borderColor: isCrit ? '#ef4444' : '#0d9488',
                backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(13, 148, 136, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: true } }
        }
    });
}

function setupVoiceScribe() {
    if (!('webkitSpeechRecognition' in window)) return;

    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = function () {
        const btn = document.getElementById('mic-btn');
        if (btn) btn.classList.add('text-red-600', 'animate-pulse');
        document.getElementById('nurse-note').placeholder = "Listening...";
    };

    recognition.onend = function () {
        const btn = document.getElementById('mic-btn');
        if (btn) btn.classList.remove('text-red-600', 'animate-pulse');
        document.getElementById('nurse-note').placeholder = "Clinical note or observation...";
    };

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        const noteArea = document.getElementById('nurse-note');
        if (noteArea) {
            noteArea.value += (noteArea.value ? " " : "") + transcript;
        }
    };
}

function toggleVoiceRecording() {
    if (recognition) {
        try { recognition.start(); } catch (e) { recognition.stop(); }
    } else {
        alert("Voice recognition not supported in this browser.");
    }
}

// Emergency Polling
setInterval(async () => {
    try {
        const r = await fetch(`${API_BASE}/emergency`);
        if (r.ok) {
            const d = await r.json();
            if (d.active !== isEmergency) setEmergencyState(d.active);
        }
    } catch (e) {
    }
}, 2000);

async function toggleEmergency() {
    try {
        const response = await fetch(`${API_BASE}/emergency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !isEmergency })
        });
        if (response.ok) {
            const data = await response.json();
            setEmergencyState(data.active);
        } else {
        }
    } catch (err) {
        console.error('Emergency toggle failed:', err);
    }
}

function setEmergencyState(active) {
    isEmergency = active;
    const b = document.body;
    const s = document.getElementById('sidebar');
    const h = document.getElementById('header');

    if (active) {
        b.classList.add('bg-red-50');
        s.classList.remove('bg-medical-900'); s.classList.add('bg-red-900');
        h.classList.add('bg-red-50');
        if (!document.getElementById('em-banner')) {
            const div = document.createElement('div');
            div.id = 'em-banner';
            div.className = "fixed top-0 w-full bg-red-600 text-white text-center font-bold z-50 animate-pulse";
            div.innerText = "CODE RED ACTIVE";
            document.body.prepend(div);
        }
    } else {
        b.classList.remove('bg-red-50');
        s.classList.add('bg-medical-900'); s.classList.remove('bg-red-900');
        h.classList.remove('bg-red-50');
        const ban = document.getElementById('em-banner');
        if (ban) ban.remove();
    }
}

// Reports
function showDashboard() {
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('reports-view').classList.add('hidden');
}
function showReports() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('reports-view').classList.remove('hidden');
    renderReports();
}
function renderReports() {
    const body = document.getElementById('reports-table-body');
    body.innerHTML = '';
    patients.forEach(p => {
        body.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-50 transition">
                <td class="p-4 font-mono text-xs text-slate-500">#${p.id}</td>
                <td class="p-4 font-bold text-slate-700">${p.name}</td>
                <td class="p-4 text-xs font-bold">${p.status}</td>
                <td class="p-4 text-xs text-slate-500">${p.discharge_time || 'TBD'}</td>
            </tr>
        `;
    });
}

function generateAI() {
    if (!currentPatient) return;
    document.getElementById('ai-box').classList.remove('hidden');
    document.getElementById('ai-text').innerText = "Analyzing...";
    setTimeout(() => {
        document.getElementById('ai-text').innerHTML = currentPatient.status === 'Critical' ? "<b>CRITICAL:</b> Requires immediate attention." : "<b>STABLE:</b> Recovering well.";
    }, 1000);
}

// Modals
function openAddPatientModal() { document.getElementById('add-patient-modal').classList.remove('hidden'); }
function closeAddPatientModal() { document.getElementById('add-patient-modal').classList.add('hidden'); }