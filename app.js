const DEFAULT_SESI = "Sesi 1 (Registrasi)";

let state = {
    // Memulihkan sesi login dari sessionStorage jika halaman di-refresh
    currentUser: JSON.parse(sessionStorage.getItem('session_user')) || null,
    activeTab: 'presensi',
    selectedSesi: localStorage.getItem('last_selected_sesi') || DEFAULT_SESI,
    apiUrl: 'https://script.google.com/macros/s/AKfycbxuoGOgzWhlcaHV7pGdOEWiKalQKOmiHZEhF01PIS4Tc4ldYTZKX8CxiT2qpffnuhW9NQ/exec',
    html5QrcodeScanner: null,
    dataMaster: [],
    dataPresensi: [],
    dataAkun: [
        { Username: 'admin', Password: '123', Nama: 'Administrator Utama', Role: 'Administrator' },
        { Username: 'petugas', Password: '123', Nama: 'Petugas Lapangan', Role: 'Petugas' }
    ]
};

window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sesiSelect')) {
        document.getElementById('sesiSelect').value = state.selectedSesi;
    }
    if (document.getElementById('belumAbsenSesiSelect')) {
        document.getElementById('belumAbsenSesiSelect').value = state.selectedSesi;
    }

    // Cek sesi login saat halaman dimuat
    checkExistingSession();

    if (state.apiUrl) {
        fetchInitialDataFromGAS();
    }
});

function checkExistingSession() {
    if (state.currentUser) {
        document.getElementById('userInfoHeader')?.classList.remove('hidden');
        document.getElementById('headerName').innerText = state.currentUser.nama;
        document.getElementById('headerRole').innerText = state.currentUser.role;
        
        document.getElementById('loginSection')?.classList.add('hidden');
        document.getElementById('dashboardSection')?.classList.remove('hidden');

        renderNavTabs();
        switchTab('presensi');
    }
}

async function fetchInitialDataFromGAS() {
    if (!state.apiUrl) return;
    try {
        const response = await fetch(`${state.apiUrl}?action=getInitialData`);
        const result = await response.json();
        if (result.success) {
            if (result.master) state.dataMaster = result.master;
            if (result.presensi) state.dataPresensi = result.presensi;
            if (result.akun && result.akun.length > 0) state.dataAkun = result.akun;
            console.log("Data berhasil dimuat dari Google Sheets!");
            
            if (state.currentUser) {
                if (state.activeTab === 'presensi') renderRecentPresensiLog();
                if (state.activeTab === 'belumAbsen') renderBelumAbsenGrid();
                if (state.activeTab === 'rekap') renderRekapDataGrid();
            }
        }
    } catch (err) {
        console.warn("Gagal terhubung ke API backend, menggunakan data lokal.", err);
    }
}

function handleLogin(e) {
    if (e) e.preventDefault();
    
    const userInput = document.getElementById('loginUsername');
    const passInput = document.getElementById('loginPassword');

    if (!userInput || !passInput) return;

    const u = userInput.value.trim();
    const p = passInput.value.trim();

    if (!u || !p) {
        Swal.fire({
            icon: 'warning',
            title: 'Form Belum Lengkap',
            text: 'Silakan isi username dan password!'
        });
        return;
    }

    const found = state.dataAkun.find(a => 
        String(a.Username).toLowerCase() === u.toLowerCase() && String(a.Password) === p
    );

    if (found) {
        const userObj = { username: found.Username, nama: found.Nama, role: found.Role };
        state.currentUser = userObj;
        
        sessionStorage.setItem('session_user', JSON.stringify(userObj));

        document.getElementById('userInfoHeader').classList.remove('hidden');
        document.getElementById('headerName').innerText = found.Nama;
        document.getElementById('headerRole').innerText = found.Role;
        
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('dashboardSection').classList.remove('hidden');

        renderNavTabs();
        switchTab('presensi');

        Swal.fire({
            icon: 'success',
            title: 'Login Berhasil',
            text: `Selamat datang, ${found.Nama} (${found.Role})`,
            timer: 1500,
            showConfirmButton: false
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Login Gagal',
            text: 'Username atau password tidak cocok.'
        });
    }
}

function handleLogout() {
    stopScanner();
    state.currentUser = null;
    sessionStorage.removeItem('session_user');

    if (document.getElementById('loginUsername')) document.getElementById('loginUsername').value = '';
    if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';
    
    document.getElementById('userInfoHeader')?.classList.add('hidden');
    document.getElementById('dashboardSection')?.classList.add('hidden');
    document.getElementById('loginSection')?.classList.remove('hidden');
}

function renderNavTabs() {
    const container = document.getElementById('navTabs');
    if (!container) return;
    container.innerHTML = '';

    const isAdmin = state.currentUser && state.currentUser.role === 'Administrator';

    const tabs = [
        { id: 'presensi', label: 'Presensi QR-Code', icon: 'fa-qrcode', show: true },
        { id: 'rekap', label: 'Data Rekap Absen', icon: 'fa-chart-pie', show: isAdmin },
        { id: 'belumAbsen', label: 'Peserta Belum Absen', icon: 'fa-user-clock', show: true },
        { id: 'kelolaAkun', label: 'Kelola Akun', icon: 'fa-user-gear', show: isAdmin }
    ];

    tabs.forEach(tab => {
        if (tab.show) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.onclick = () => switchTab(tab.id);
            btn.className = `px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                state.activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`;
            btn.id = `navBtn_${tab.id}`;
            btn.innerHTML = `<i class="fa-solid ${tab.icon}"></i> ${tab.label}`;
            container.appendChild(btn);
        }
    });
}

function switchTab(tabId) {
    const isAdmin = state.currentUser && state.currentUser.role === 'Administrator';
    if ((tabId === 'rekap' || tabId === 'kelolaAkun') && !isAdmin) {
        Swal.fire('Akses Ditolak', 'Halaman ini hanya untuk Administrator.', 'warning');
        return;
    }

    state.activeTab = tabId;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    document.querySelectorAll('#navTabs button').forEach(btn => {
        btn.className = 'px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition text-slate-600 hover:bg-slate-100';
    });

    const activeBtn = document.getElementById(`navBtn_${tabId}`);
    if (activeBtn) {
        activeBtn.className = 'px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition bg-indigo-600 text-white shadow';
    }

    if (tabId === 'presensi') {
        document.getElementById('tabPresensi')?.classList.remove('hidden');
        renderRecentPresensiLog();
    } else if (tabId === 'rekap') {
        document.getElementById('tabDataAbsen')?.classList.remove('hidden');
        renderRekapDataGrid();
    } else if (tabId === 'belumAbsen') {
        document.getElementById('tabBelumAbsen')?.classList.remove('hidden');
        renderBelumAbsenGrid();
    } else if (tabId === 'kelolaAkun') {
        document.getElementById('tabKelolaAkun')?.classList.remove('hidden');
        renderAccountList();
    }
}

function handleSesiChange(val) {
    state.selectedSesi = val;
    localStorage.setItem('last_selected_sesi', val);
    
    const elemBelumAbsen = document.getElementById('belumAbsenSesiSelect');
    if (elemBelumAbsen) elemBelumAbsen.value = val;
    
    renderRecentPresensiLog();
    if (state.activeTab === 'belumAbsen') renderBelumAbsenGrid();
}

function startScanner() {
    document.getElementById('qrPlaceholder')?.classList.add('hidden');
    document.getElementById('btnStartCamera')?.classList.add('hidden');
    document.getElementById('btnStopCamera')?.classList.remove('hidden');

    state.html5QrcodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

    state.html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Kamera Error:", err);
        Swal.fire('Kamera Error', 'Gagal mengakses kamera.', 'error');
        stopScanner();
    });
}

function stopScanner() {
    if (state.html5QrcodeScanner) {
        state.html5QrcodeScanner.stop().then(() => {
            document.getElementById('qrPlaceholder')?.classList.remove('hidden');
            document.getElementById('btnStartCamera')?.classList.remove('hidden');
            document.getElementById('btnStopCamera')?.classList.add('hidden');
        }).catch(err => console.log(err));
    }
}

function onScanSuccess(decodedText) {
    processPresensi(decodedText.trim());
}

function onScanFailure(error) {
    // Scanning...
}

function handleManualSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('manualIdInput').value.trim();
    if (!id) return;
    processPresensi(id);
    document.getElementById('manualIdInput').value = '';
}

// LOGIKA PRESENSI ANTI-DUPLIKAT LOKAL (SENSITIF TERHADAP SPASI DAN KAPITALISASI)
function processPresensi(scannedId, targetStatus = 'Hadir') {
    const participant = state.dataMaster.find(m => String(m.ID).trim().toLowerCase() === String(scannedId).trim().toLowerCase());

    if (!participant) {
        Swal.fire({
            icon: 'error',
            title: 'ID Tidak Ditemukan!',
            text: `Peserta dengan ID "${scannedId}" tidak terdaftar di DataMaster.`,
            timer: 2500,
            showConfirmButton: false
        });
        return;
    }

    const cleanScannedId = String(participant.ID).trim().toLowerCase();
    const cleanSesi = String(state.selectedSesi).trim().toLowerCase();

    // Mencocokkan data lokal berdasarkan ID dan Sesi
    const existingIndex = state.dataPresensi.findIndex(p => 
        String(p.ID).trim().toLowerCase() === cleanScannedId && 
        String(p.Sesi).trim().toLowerCase() === cleanSesi
    );

    if (existingIndex !== -1) {
        const oldStatus = state.dataPresensi[existingIndex].Status;
        if (oldStatus === targetStatus) {
            Swal.fire({
                icon: 'warning',
                title: 'Sudah Absen',
                text: `${participant.Nama} sudah tercatat dengan status "${targetStatus}" pada ${state.selectedSesi}`,
                timer: 2500,
                showConfirmButton: false
            });
            return;
        }

        // Timpa data lama dengan data status terbaru
        state.dataPresensi[existingIndex].Status = targetStatus;
        state.dataPresensi[existingIndex].Waktu = new Date().toLocaleString('id-ID');
        state.dataPresensi[existingIndex].Pengabsen = state.currentUser ? state.currentUser.username : 'petugas';
    } else {
        const newEntry = {
            ID: participant.ID,
            Nama: participant.Nama,
            Kelompok: participant.Kelompok,
            Dapukan: participant.Dapukan,
            Sesi: state.selectedSesi,
            Pengabsen: state.currentUser ? state.currentUser.username : 'petugas',
            Waktu: new Date().toLocaleString('id-ID'),
            Status: targetStatus
        };
        state.dataPresensi.push(newEntry);
    }

    renderRecentPresensiLog();
    if (state.activeTab === 'belumAbsen') renderBelumAbsenGrid();

    if (state.apiUrl) {
        fetch(state.apiUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'recordPresensi',
                id: participant.ID,
                sesi: state.selectedSesi,
                pengabsen: state.currentUser ? state.currentUser.username : 'petugas',
                status: targetStatus
            })
        }).catch(e => console.error("Sync error:", e));
    }

    Swal.fire({
        icon: 'success',
        title: 'Presensi Diperbarui!',
        html: `
            <div class="text-left bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 space-y-1 text-sm">
                <p><b>ID:</b> ${participant.ID}</p>
                <p><b>Nama:</b> <span class="text-indigo-600 font-bold">${participant.Nama}</span></p>
                <p><b>Kelompok:</b> ${participant.Kelompok}</p>
                <p><b>Sesi:</b> ${state.selectedSesi}</p>
                <p><b>Status:</b> <span class="text-emerald-600 font-bold">${targetStatus}</span></p>
            </div>
        `,
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false
    });
}

function quickUpdateStatus(id, sesi, status) {
    const participant = state.dataMaster.find(m => String(m.ID).trim().toLowerCase() === String(id).trim().toLowerCase());
    if (!participant) return;

    const cleanId = String(id).trim().toLowerCase();
    const cleanSesi = String(sesi).trim().toLowerCase();

    const existingIndex = state.dataPresensi.findIndex(p => 
        String(p.ID).trim().toLowerCase() === cleanId && 
        String(p.Sesi).trim().toLowerCase() === cleanSesi
    );

    if (existingIndex !== -1) {
        state.dataPresensi[existingIndex].Status = status;
        state.dataPresensi[existingIndex].Waktu = new Date().toLocaleString('id-ID');
        state.dataPresensi[existingIndex].Pengabsen = state.currentUser ? state.currentUser.username : 'petugas';
    } else {
        state.dataPresensi.push({
            ID: participant.ID,
            Nama: participant.Nama,
            Kelompok: participant.Kelompok,
            Dapukan: participant.Dapukan,
            Sesi: sesi,
            Pengabsen: state.currentUser ? state.currentUser.username : 'petugas',
            Waktu: new Date().toLocaleString('id-ID'),
            Status: status
        });
    }

    renderBelumAbsenGrid();
    renderRecentPresensiLog();

    if (state.apiUrl) {
        fetch(state.apiUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'recordPresensi',
                id: id,
                sesi: sesi,
                pengabsen: state.currentUser ? state.currentUser.username : 'petugas',
                status: status
            })
        });
    }

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status ${participant.Nama} diubah ke ${status}`,
        showConfirmButton: false,
        timer: 2000
    });
}

function renderRecentPresensiLog() {
    const list = document.getElementById('recentPresensiList');
    if (!list) return;
    
    const filtered = state.dataPresensi.filter(p => String(p.Sesi).trim().toLowerCase() === String(state.selectedSesi).trim().toLowerCase());

    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-400 italic">Belum ada data presensi yang masuk pada sesi ini.</p>`;
        return;
    }

    list.innerHTML = filtered.slice().reverse().map(p => `
        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
            <div>
                <span class="font-bold text-slate-800">${p.Nama}</span> (${p.Dapukan})
                <div class="text-[10px] text-slate-500">${p.Kelompok} • ${p.Waktu}</div>
            </div>
            <span class="${p.Status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} font-bold px-2 py-0.5 rounded text-[10px]">
                ${p.Status}
            </span>
        </div>
    `).join('');
}

function renderRekapDataGrid() {
    const container = document.getElementById('rekapGridContainer');
    if (!container) return;
    
    const filterElem = document.getElementById('rekapSesiFilter');
    const sesiFilter = filterElem ? filterElem.value : 'ALL';

    const dapukanGroups = {};

    state.dataMaster.forEach(m => {
        if (!dapukanGroups[m.Dapukan]) dapukanGroups[m.Dapukan] = [];

        let attendances = state.dataPresensi.filter(p => String(p.ID).trim().toLowerCase() === String(m.ID).trim().toLowerCase());
        if (sesiFilter !== 'ALL') {
            attendances = attendances.filter(p => String(p.Sesi).trim().toLowerCase() === String(sesiFilter).trim().toLowerCase());
        }

        const sesiList = attendances.map(a => `${a.Sesi} (${a.Status})`).join(', ');

        dapukanGroups[m.Dapukan].push({
            ID: m.ID,
            Nama: m.Nama,
            Kelompok: m.Kelompok,
            Count: attendances.length,
            SesiString: sesiList || '-'
        });
    });

    container.innerHTML = Object.keys(dapukanGroups).map(dapukan => `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h3 class="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    <i class="fa-solid fa-folder-tree text-indigo-600"></i> Dapukan: ${dapukan}
                </h3>
                <span class="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    ${dapukanGroups[dapukan].length} Orang
                </span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="text-slate-400 border-b">
                            <th class="py-2">No</th>
                            <th class="py-2">Nama</th>
                            <th class="py-2 text-center">Jumlah Rekap Absen</th>
                            <th class="py-2">Jenis Sesi Absen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${dapukanGroups[dapukan].map((item, idx) => `
                            <tr>
                                <td class="py-2 text-slate-400">${idx + 1}</td>
                                <td class="py-2 font-medium text-slate-800">${item.Nama}</td>
                                <td class="py-2 text-center font-bold text-indigo-600">${item.Count}</td>
                                <td class="py-2 text-slate-500 text-[11px]">${item.SesiString}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

// RENDER GRID PESERTA BELUM ABSEN TERMASUK FILTER SEARCH REAL-TIME
function renderBelumAbsenGrid() {
    const container = document.getElementById('belumAbsenGridContainer');
    if (!container) return;

    const targetSesiElem = document.getElementById('belumAbsenSesiSelect');
    const targetSesi = targetSesiElem ? targetSesiElem.value : state.selectedSesi;

    const searchInput = document.getElementById('searchBelumAbsenInput');
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const cleanTargetSesi = String(targetSesi).trim().toLowerCase();

    // Dapatkan daftar ID yang sudah absen/izin di sesi ini
    const attendedIds = state.dataPresensi
        .filter(p => String(p.Sesi).trim().toLowerCase() === cleanTargetSesi)
        .map(p => String(p.ID).trim().toLowerCase());

    // Filter peserta dari DataMaster yang belum ada di daftar attendedIds
    let unabsentList = state.dataMaster.filter(m => !attendedIds.includes(String(m.ID).trim().toLowerCase()));

    const badgeElem = document.getElementById('belumAbsenBadge');
    if (badgeElem) {
        badgeElem.innerText = `Total Belum Absen: ${unabsentList.length} Orang`;
    }

    // Filter berdasarkan kata kunci pencarian (Nama atau Kelompok)
    if (searchQuery) {
        unabsentList = unabsentList.filter(m => 
            String(m.Nama).toLowerCase().includes(searchQuery) ||
            String(m.Kelompok).toLowerCase().includes(searchQuery)
        );
    }

    if (unabsentList.length === 0) {
        if (searchQuery) {
            container.innerHTML = `
                <div class="col-span-full bg-slate-50 border border-slate-200 p-8 rounded-2xl text-center">
                    <i class="fa-solid fa-user-slash text-slate-400 text-3xl mb-2"></i>
                    <h3 class="font-bold text-slate-700 text-sm">Peserta Tidak Ditemukan</h3>
                    <p class="text-xs text-slate-500 mt-1">Tidak ditemukan peserta dengan kata kunci "${searchQuery}" pada ${targetSesi}.</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full bg-emerald-50 border border-emerald-200 p-8 rounded-2xl text-center">
                    <i class="fa-solid fa-circle-check text-emerald-500 text-4xl mb-2"></i>
                    <h3 class="font-bold text-emerald-900 text-base">Lengkap! Semua Peserta Sudah Memiliki Status Presensi</h3>
                    <p class="text-xs text-emerald-700 mt-1">Tidak ada peserta yang belum absen pada ${targetSesi}.</p>
                </div>
            `;
        }
        return;
    }

    const grouped = {};
    unabsentList.forEach(m => {
        if (!grouped[m.Dapukan]) grouped[m.Dapukan] = [];
        grouped[m.Dapukan].push(m);
    });

    container.innerHTML = Object.keys(grouped).map(dapukan => `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i class="fa-solid fa-users-viewfinder text-indigo-600"></i> Dapukan: ${dapukan}
                </h3>
                <span class="bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    ${grouped[dapukan].length} Belum Absen
                </span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="text-slate-400 border-b">
                            <th class="py-2">No</th>
                            <th class="py-2">Nama</th>
                            <th class="py-2">Kelompok</th>
                            <th class="py-2 text-right">Keterangan Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${grouped[dapukan].map((m, idx) => `
                            <tr>
                                <td class="py-2.5 text-slate-400">${idx + 1}</td>
                                <td class="py-2.5 font-medium text-slate-800">${m.Nama}</td>
                                <td class="py-2.5 text-slate-500">${m.Kelompok}</td>
                                <td class="py-2.5 text-right space-x-1">
                                    <button onclick="quickUpdateStatus('${m.ID}', '${targetSesi}', 'Hadir')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] transition">
                                        Hadir
                                    </button>
                                    <button onclick="quickUpdateStatus('${m.ID}', '${targetSesi}', 'Izin')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] transition">
                                        Izin
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

function handleAddAccount(e) {
    e.preventDefault();
    const nama = document.getElementById('accNama').value.trim();
    const username = document.getElementById('accUsername').value.trim();
    const password = document.getElementById('accPassword').value.trim();
    const role = document.getElementById('accRole').value;

    if (state.dataAkun.some(a => a.Username.toLowerCase() === username.toLowerCase())) {
        Swal.fire('Gagal', 'Username sudah terdaftar!', 'error');
        return;
    }

    state.dataAkun.push({ Username: username, Password: password, Nama: nama, Role: role });
    renderAccountList();

    if (state.apiUrl) {
        fetch(state.apiUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'addAccount', username, password, nama, role })
        });
    }

    Swal.fire('Berhasil', `Akun ${nama} (${role}) berhasil ditambahkan.`, 'success');
    document.getElementById('accNama').value = '';
    document.getElementById('accUsername').value = '';
    document.getElementById('accPassword').value = '';
}

function renderAccountList() {
    const body = document.getElementById('accountTableBody');
    if (!body) return;

    body.innerHTML = state.dataAkun.map((a, idx) => `
        <tr class="hover:bg-slate-50">
            <td class="p-3 text-slate-400">${idx + 1}</td>
            <td class="p-3 font-semibold text-slate-800">${a.Nama}</td>
            <td class="p-3 text-slate-600">${a.Username}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.Role === 'Administrator' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}">
                    ${a.Role}
                </span>
            </td>
        </tr>
    `).join('');
}

function openWordPressViewModal() {
    document.getElementById('wpModal')?.classList.remove('hidden');
    document.getElementById('wpSesiSelect').value = state.selectedSesi;
    renderWordPressViewData();
}

function closeWordPressViewModal() {
    document.getElementById('wpModal')?.classList.add('hidden');
}

function renderWordPressViewData() {
    const container = document.getElementById('wpContentContainer');
    if (!container) return;

    const targetSesi = document.getElementById('wpSesiSelect').value;
    const cleanTargetSesi = String(targetSesi).trim().toLowerCase();

    const attendedIds = state.dataPresensi
        .filter(p => String(p.Sesi).trim().toLowerCase() === cleanTargetSesi)
        .map(p => String(p.ID).trim().toLowerCase());

    const unabsent = state.dataMaster.filter(m => !attendedIds.includes(String(m.ID).trim().toLowerCase()));

    if (unabsent.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 bg-emerald-50 rounded-xl">
                <p class="font-bold text-emerald-800">Semua Peserta Telah Absen pada ${targetSesi}</p>
            </div>
        `;
        return;
    }

    const grouped = {};
    unabsent.forEach(m => {
        if (!grouped[m.Dapukan]) grouped[m.Dapukan] = [];
        grouped[m.Dapukan].push(m);
    });

    container.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-xl font-bold text-slate-900">Daftar Peserta Belum Absen</h2>
            <p class="text-sm text-indigo-600 font-semibold">${targetSesi}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${Object.keys(grouped).map(dapukan => `
                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 class="font-bold text-slate-800 border-b pb-2 mb-2 text-sm flex justify-between">
                        <span>Dapukan: ${dapukan}</span>
                        <span class="text-rose-600 text-xs">${grouped[dapukan].length} Orang</span>
                    </h4>
                    <ol class="list-decimal list-inside text-xs space-y-1.5 text-slate-700">
                        ${grouped[dapukan].map(p => `
                            <li class="py-0.5 border-b border-slate-50"><b>${p.Nama}</b> <span class="text-slate-400">(${p.Kelompok})</span></li>
                        `).join('')}
                    </ol>
                </div>
            `).join('')}
        </div>
    `;
}
