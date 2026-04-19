document.addEventListener('DOMContentLoaded', () => {

    // ================= GLOBAL LOGOUT =================
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/'; 
        });
    }

    // ================= WELCOME PAGE =================
    if (window.location.pathname === '/') {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.location.href = '/student'; 
        });
    }

    // ================= ADMIN AUTH =================
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-pass').value;
            const authMsg = document.getElementById('auth-msg');

            const res = await fetch('/api/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            authMsg.innerText = data.message;
            authMsg.style.color = data.success ? '#00E676' : '#FF1744';
            if (data.success) setTimeout(() => { window.location.href = '/login'; }, 1500);
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-pass').value;
            const authMsg = document.getElementById('auth-msg');

            const res = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) window.location.href = '/dashboard';
            else { authMsg.innerText = data.message; authMsg.style.color = '#FF1744'; }
        });
    }

    // ================= STUDENT PORTAL =================
    const studentLoginForm = document.getElementById('student-login-form');
    if (studentLoginForm) {
        studentLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('student-email').value;
            const res = await fetch('/api/student/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) window.location.href = '/student/portal';
        });
    }

    const studentUploadForm = document.getElementById('student-upload-form');
    if (studentUploadForm) {
        studentUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const files = document.getElementById('student-files').files;
            if (files.length > 10) return alert("Maximum 10 files allowed.");

            const formData = new FormData();
            formData.append('assignment_tag', document.getElementById('assignment-tag').value);
            for (let i = 0; i < files.length; i++) formData.append('files', files[i]);

            const btn = document.getElementById('student-submit-btn');
            const msg = document.getElementById('upload-msg');
            btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Uploading...";
            btn.disabled = true;

            try {
                const res = await fetch('/api/student/upload', { method: 'POST', body: formData });
                const data = await res.json();
                msg.innerText = data.message;
                msg.style.color = data.success ? '#00E676' : '#FF1744';
                if(data.success) studentUploadForm.reset();
            } catch (err) { msg.innerText = "Upload failed."; msg.style.color = '#FF1744'; } 
            finally { btn.innerHTML = "<i class='fa-solid fa-upload'></i> Upload to Server"; btn.disabled = false; }
        });
    }

    // ================= ADMIN DASHBOARD =================
    const adminCompareForm = document.getElementById('admin-compare-form');
    if (adminCompareForm) {
        const resultsList = document.getElementById('results-list');
        const historyTbody = document.getElementById('history-tbody');
        const studentUploadsList = document.getElementById('student-uploads-list');

        async function fetchStudentFiles() {
            try {
                const res = await fetch('/api/admin/student-files');
                const data = await res.json();
                if (data.success) {
                    studentUploadsList.innerHTML = '';
                    if (data.files.length === 0) return studentUploadsList.innerHTML = '<p style="text-align:center; opacity:0.5;">No files found.</p>';
                    data.files.forEach(f => {
                        studentUploadsList.innerHTML += `
                            <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;">
                                <input type="checkbox" class="student-file-checkbox" value="${f.filepath}" data-id="${f.id}" data-tag="${f.assignment_tag}" id="file_${f.id}" style="cursor:pointer; width: 18px; height: 18px;">
                                <label for="file_${f.id}" style="cursor:pointer; display:flex; flex-direction:column; width:100%;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:600; color:#fff;">${f.filename}</span>
                                        <span style="background: rgba(0, 210, 255, 0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #00d2ff; border: 1px solid #00d2ff;">${f.assignment_tag}</span>
                                    </div>
                                    <span style="font-size:0.75rem; color:#ccc; margin-top:3px;">${f.student_email} &bull; ${f.uploaded_at}</span>
                                </label>
                            </div>
                        `;
                    });
                }
            } catch (e) { studentUploadsList.innerHTML = '<p style="color:red;">Error loading files.</p>'; }
        }
        fetchStudentFiles(); 

        document.getElementById('batch-select-btn').addEventListener('click', () => {
            const selectedTag = document.getElementById('batch-select-dropdown').value;
            if (!selectedTag) return alert("Select an experiment first.");
            let count = 0;
            document.querySelectorAll('.student-file-checkbox').forEach(cb => {
                cb.checked = (cb.dataset.tag === selectedTag);
                if(cb.checked) count++;
            });
            if(count === 0) alert(`No files found for ${selectedTag}.`);
        });

        document.getElementById('clear-select-btn').addEventListener('click', () => {
            document.querySelectorAll('.student-file-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('batch-select-dropdown').value = "";
        });

        document.getElementById('delete-select-btn').addEventListener('click', async (e) => {
            const checkedBoxes = document.querySelectorAll('.student-file-checkbox:checked');
            if (checkedBoxes.length === 0) return alert("Select files to delete.");
            if (!confirm(`Permanently delete ${checkedBoxes.length} file(s)?`)) return;
            
            const fileIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.id));
            e.target.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Deleting...";
            e.target.disabled = true;

            try {
                const res = await fetch('/api/admin/delete-files', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file_ids: fileIds })
                });
                const data = await res.json();
                if (data.success) fetchStudentFiles(); else alert(data.message);
            } catch (err) { alert("Error deleting files."); } 
            finally { e.target.innerHTML = "<i class='fa-solid fa-trash'></i> Delete Selected"; e.target.disabled = false; }
        });

        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).style.display = 'block';
            });
        });

        document.getElementById('load-history-btn').addEventListener('click', async () => {
            historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';
            const res = await fetch('/api/history');
            const data = await res.json();
            if (data.success) {
                historyTbody.innerHTML = '';
                if(data.history.length === 0) return historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5;">No past scans found.</td></tr>';
                data.history.forEach(item => {
                    let badgeClass = item.similarity > 50 ? 'sim-badge-high' : (item.similarity > 20 ? 'sim-badge-med' : 'sim-badge-low');
                    historyTbody.innerHTML += `
                        <tr>
                            <td style="font-size: 0.85rem; color: #aaa;">${item.scanned_at}</td>
                            <td><i class="fa-solid fa-file-pdf" style="color:#00d2ff;"></i> ${item.parent_filename}</td>
                            <td><i class="fa-solid fa-file" style="color:#ccc;"></i> ${item.child_filename}</td>
                            <td><span class="${badgeClass}">${item.similarity}%</span></td>
                            <td style="font-style:italic;">${item.hidden_author}</td>
                        </tr>
                    `;
                });
            }
        });

        adminCompareForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const checkedBoxes = document.querySelectorAll('.student-file-checkbox:checked');
            if (checkedBoxes.length === 0) return alert("Please select student files from the list.");
            const selectedFilePaths = Array.from(checkedBoxes).map(cb => cb.value).join(',');
            const parentFile = document.getElementById('parent-file').files[0];

            const formData = new FormData();
            formData.append('parent', parentFile);
            formData.append('child_filepaths', selectedFilePaths);

            const compareBtn = document.getElementById('compare-btn');
            compareBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Scanning...";
            compareBtn.disabled = true;

            try {
                const res = await fetch('/api/compare', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) displayResults(data.results, resultsList);
                else alert(data.message);
            } catch (error) { alert("Error during comparison."); } 
            finally { compareBtn.innerHTML = "<i class='fa-solid fa-fingerprint'></i> Run Plagiarism Scan"; compareBtn.disabled = false; }
        });

        function displayResults(results, container) {
            container.innerHTML = '';
            results.forEach(result => {
                const card = document.createElement('div');
                let matchClass = result.similarity > 50 ? 'match-high' : (result.similarity > 20 ? 'match-med' : 'match-low');
                let colorHex = result.similarity > 50 ? '#FF1744' : (result.similarity > 20 ? '#FFEA00' : '#00E676');
                card.className = `result-card ${matchClass} fade-in`;
                let snippetsHtml = result.similar_content_samples.map(s => `<span class="snippet">"...${s}..."</span>`).join(' ') || "<span class='snippet'>No similarities.</span>";
                card.innerHTML = `
                    <h4 style="margin-top:0; color: var(--primary);">📄 ${result.filename}</h4>
                    <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed rgba(0, 210, 255, 0.3);">
                        <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: var(--primary);">🕵️ Forensics</p>
                        <p style="margin: 0 0 4px 0; font-size: 0.9rem; color: #ccc;">Author: <strong style="color:#fff;">${result.hidden_author}</strong></p>
                        <p style="margin: 0; font-size: 0.9rem; color: #ccc;">Created On: <strong style="color:#fff;">${result.hidden_date}</strong></p>
                    </div>
                    <p><strong>Similarity:</strong> <span style="font-size: 1.3rem; font-weight: bold; color: ${colorHex};">${result.similarity}%</span></p>
                    <p style="margin-bottom:5px;"><strong>Snippets:</strong></p><div>${snippetsHtml}</div>
                `;
                container.appendChild(card);
            });
        }
    }
});