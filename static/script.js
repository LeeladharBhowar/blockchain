// static/script.js

// Wait for the HTML to fully load before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. WELCOME PAGE LOGIC
    // ==========================================
    if (window.location.pathname === '/') {
        // Allow user to press 'Enter' to go to the login page
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                window.location.href = '/login';
            }
        });
    }

    // ==========================================
    // 2. REGISTRATION PAGE LOGIC
    // ==========================================
    const regForm = document.getElementById('register-form');
    if (regForm) {
        const regPass = document.getElementById('reg-pass');
        const meterBar = document.getElementById('meter-bar');
        const meterText = document.getElementById('meter-text');
        const regSubmitBtn = document.getElementById('reg-submit-btn');

        const rules = {
            length: { regex: /.{8,}/, el: document.getElementById('rule-length') },
            upper: { regex: /[A-Z]/, el: document.getElementById('rule-upper') },
            number: { regex: /[0-9]/, el: document.getElementById('rule-number') },
            special: { regex: /[@$!%*?&]/, el: document.getElementById('rule-special') }
        };

        // Password Strength Meter
        regPass.addEventListener('input', (e) => {
            const val = e.target.value;
            let strength = 0;

            for (const key in rules) {
                if (rules[key].regex.test(val)) {
                    rules[key].el.className = 'rule-valid';
                    strength++;
                } else {
                    rules[key].el.className = 'rule-invalid';
                }
            }

            if (val.length === 0) {
                meterBar.style.width = '0%';
                meterText.innerText = '';
                regSubmitBtn.disabled = true;
            } else if (strength <= 2) {
                meterBar.style.width = '33%';
                meterBar.style.background = '#ff7675';
                meterText.innerText = 'Weak';
                meterText.style.color = '#ff7675';
                regSubmitBtn.disabled = true;
            } else if (strength === 3) {
                meterBar.style.width = '66%';
                meterBar.style.background = '#fdcb6e';
                meterText.innerText = 'Medium';
                meterText.style.color = '#fdcb6e';
                regSubmitBtn.disabled = true;
            } else if (strength === 4) {
                meterBar.style.width = '100%';
                meterBar.style.background = '#00b894';
                meterText.innerText = 'Strong';
                meterText.style.color = '#00b894';
                regSubmitBtn.disabled = false; // Enable only if strong
            }
        });

        // Submit Registration
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = regPass.value;
            const authMsg = document.getElementById('auth-msg');

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            
            authMsg.innerText = data.message;
            authMsg.style.color = data.success ? '#00E676' : '#FF1744';
            
            if (data.success) {
                setTimeout(() => { window.location.href = '/login'; }, 1500);
            }
        });
    }

    // ==========================================
    // 3. LOGIN PAGE LOGIC
    // ==========================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-pass').value;
            const authMsg = document.getElementById('auth-msg');

            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                window.location.href = '/dashboard'; // Redirect to dashboard
            } else {
                authMsg.innerText = data.message;
                authMsg.style.color = '#FF1744';
            }
        });
    }

    // ==========================================
    // 4. DASHBOARD PAGE LOGIC
    // ==========================================
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        const logoutBtn = document.getElementById('logout-btn');
        const resultsList = document.getElementById('results-list');
        
        // NEW: History DOM Elements
        const loadHistoryBtn = document.getElementById('load-history-btn');
        const historyTbody = document.getElementById('history-tbody');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        // Logout
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login'; // Send back to login
        });

        // NEW: Tab Switching Logic
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.style.display = 'none');
                
                // Add active to clicked
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).style.display = 'block';
            });
        });

        // NEW: Load History Logic
        loadHistoryBtn.addEventListener('click', async () => {
            historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';
            try {
                const res = await fetch('/api/history');
                const data = await res.json();
                
                if (data.success) {
                    historyTbody.innerHTML = '';
                    if(data.history.length === 0) {
                        historyTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5;">No past scans found.</td></tr>';
                        return;
                    }

                    data.history.forEach(item => {
                        let badgeClass = 'sim-badge-low';
                        if(item.similarity > 50) badgeClass = 'sim-badge-high';
                        else if (item.similarity > 20) badgeClass = 'sim-badge-med';

                        historyTbody.innerHTML += `
                            <tr>
                                <td style="font-size: 0.85rem; color: #aaa;">${item.scanned_at}</td>
                                <td><i class="fa-solid fa-file-pdf" style="color:#00d2ff; margin-right:5px;"></i> ${item.parent_filename}</td>
                                <td><i class="fa-solid fa-file" style="color:#ccc; margin-right:5px;"></i> ${item.child_filename}</td>
                                <td><span class="${badgeClass}">${item.similarity}%</span></td>
                                <td style="font-style:italic;">${item.hidden_author}</td>
                            </tr>
                        `;
                    });
                }
            } catch (err) {
                historyTbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error loading history.</td></tr>';
            }
        });

        // File Comparison Logic
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const parentFile = document.getElementById('parent-file').files[0];
            const childFiles = document.getElementById('child-files').files;

            if (childFiles.length > 5) {
                alert("Please select a maximum of 5 files to compare.");
                return;
            }

            const formData = new FormData();
            formData.append('parent', parentFile);
            for (let i = 0; i < childFiles.length; i++) {
                formData.append('children', childFiles[i]);
            }

            const compareBtn = document.getElementById('compare-btn');
            compareBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Processing Hashes...";
            compareBtn.disabled = true;

            try {
                const res = await fetch('/api/compare', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    displayResults(data.results, resultsList);
                } else {
                    alert(data.message);
                }
            } catch (error) {
                alert("An error occurred during comparison.");
            } finally {
                compareBtn.innerHTML = "<i class='fa-solid fa-fingerprint'></i> Generate Hashes & Compare";
                compareBtn.disabled = false;
            }
        });

        // Function to render the results WITH Forensic Metadata
        function displayResults(results, container) {
            container.innerHTML = '';
            
            results.forEach(result => {
                const card = document.createElement('div');
                
                let matchClass = 'match-low';
                let colorHex = '#00E676'; // Green
                
                if (result.similarity > 50) {
                    matchClass = 'match-high';
                    colorHex = '#FF1744'; // Red for high match
                } else if (result.similarity > 20) {
                    matchClass = 'match-med';
                    colorHex = '#FFEA00'; // Yellow
                }

                card.className = `result-card ${matchClass} fade-in`;
                
                let snippetsHtml = result.similar_content_samples.map(s => `<span class="snippet">"...${s}..."</span>`).join(' ');
                if (snippetsHtml === '') snippetsHtml = "<span class='snippet'>No significant similarities found.</span>";

                card.innerHTML = `
                    <h4 style="margin-top:0; color: var(--primary);">📄 ${result.filename}</h4>
                    
                    <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed rgba(0, 210, 255, 0.3);">
                        <p style="margin: 0 0 8px 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary);">🕵️ Digital Forensics</p>
                        <p style="margin: 0 0 4px 0; font-size: 0.9rem; color: #ccc;">Original Author: <strong style="color: #fff;">${result.hidden_author}</strong></p>
                        <p style="margin: 0; font-size: 0.9rem; color: #ccc;">Created On: <strong style="color: #fff;">${result.hidden_date}</strong></p>
                    </div>

                    <p><strong>Similarity Score:</strong> <span style="font-size: 1.3rem; font-weight: bold; color: ${colorHex};">${result.similarity}%</span></p>
                    
                    <p style="margin-bottom:5px;"><strong>Similar Snippets:</strong></p>
                    <div>${snippetsHtml}</div>
                `;
                container.appendChild(card);
            });
        }
    }
});