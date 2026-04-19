# app.py
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
import hashlib
import PyPDF2
import re
import os

app = Flask(__name__)
app.secret_key = 'super_secret_docuhash_key_123' 

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Leeladhar&01', # Change this to your DB password
    'database': 'blockchain'
}

def get_db_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def extract_text_and_metadata(file_or_path):
    text = ""
    metadata = {'author': 'Unknown', 'creation_date': 'Unknown'}

    if isinstance(file_or_path, str):
        file_obj = open(file_or_path, 'rb')
        filename = file_or_path
    else:
        file_obj = file_or_path
        filename = file_or_path.filename

    if filename.endswith('.pdf'):
        try:
            reader = PyPDF2.PdfReader(file_obj)
            meta = reader.metadata
            if meta:
                metadata['author'] = meta.get('/Author', 'Unknown')
                raw_date = meta.get('/CreationDate', 'Unknown')
                if raw_date != 'Unknown' and raw_date.startswith('D:'):
                    metadata['creation_date'] = f"{raw_date[2:6]}-{raw_date[6:8]}-{raw_date[8:10]} {raw_date[10:12]}:{raw_date[12:14]}"
            for page in reader.pages:
                text += page.extract_text() + " "
        except Exception as e:
            print(f"Error reading PDF {filename}: {e}")
    else:
        text = file_obj.read().decode('utf-8', errors='ignore')

    if isinstance(file_or_path, str): file_obj.close()
    return text, metadata

def get_hashed_ngrams(text, n=5):
    cleaned_text = re.sub(r'[^a-zA-Z0-9\s]', '', text).lower()
    words = cleaned_text.split()
    ngram_hashes = {}
    for i in range(len(words) - n + 1):
        ngram = " ".join(words[i:i+n])
        hash_val = hashlib.md5(ngram.encode('utf-8')).hexdigest()
        ngram_hashes[hash_val] = ngram
    return ngram_hashes

# ================= PAGE ROUTES =================
@app.route('/')
def welcome(): return render_template('welcome.html')

@app.route('/login')
def login_page(): return render_template('login.html')

@app.route('/register')
def register_page(): return render_template('register.html')

@app.route('/dashboard')
def dashboard_page():
    if 'user_id' not in session: return redirect(url_for('login_page'))
    return render_template('dashboard.html', name=session.get('user_name'))

@app.route('/student')
def student_login_page(): return render_template('student_login.html')

@app.route('/student/portal')
def student_portal_page():
    if 'student_email' not in session: return redirect(url_for('student_login_page'))
    return render_template('student_portal.html', email=session.get('student_email'))

# ================= API ROUTES =================
@app.route('/api/student/login', methods=['POST'])
def student_login():
    email = request.json.get('email')
    if not email: return jsonify({"success": False, "message": "Email is required."})
    session['student_email'] = email
    return jsonify({"success": True})

@app.route('/api/login', methods=['POST'])
def admin_login():
    data = request.json
    conn = get_db_connection()
    if not conn: return jsonify({"success": False, "message": "Database error"})
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, password_hash FROM users WHERE email = %s", (data.get('email'),))
        user = cursor.fetchone()
        if user and check_password_hash(user['password_hash'], data.get('password')):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "Invalid credentials."})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name, email, password = data.get('name'), data.get('email'), data.get('password')
    if not re.match(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$', password):
        return jsonify({"success": False, "message": "Password does not meet security requirements."})
    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)", (name, email, hashed_pw))
        conn.commit()
        return jsonify({"success": True, "message": "Registered successfully. Redirecting..."})
    except mysql.connector.IntegrityError: return jsonify({"success": False, "message": "Email already exists."})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear() 
    return jsonify({"success": True})

@app.route('/api/student/upload', methods=['POST'])
def student_upload():
    if 'student_email' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    files = request.files.getlist('files')
    assignment_tag = request.form.get('assignment_tag', 'General') 
    if len(files) > 10: return jsonify({"success": False, "message": "Maximum 10 files allowed."})
    if not files or files[0].filename == '': return jsonify({"success": False, "message": "No files selected."})
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for file in files:
            if file and (file.filename.endswith('.pdf') or file.filename.endswith('.txt')):
                filename = secure_filename(file.filename)
                unique_filename = f"{session['student_email'].split('@')[0]}_{filename}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)
                cursor.execute("INSERT INTO student_uploads (student_email, filename, filepath, assignment_tag) VALUES (%s, %s, %s, %s)", 
                               (session['student_email'], filename, filepath, assignment_tag))
        conn.commit()
        return jsonify({"success": True, "message": f"Files uploaded successfully for {assignment_tag}!"})
    except Exception as e: return jsonify({"success": False, "message": str(e)})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/admin/student-files', methods=['GET'])
def get_student_files():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, student_email, filename, filepath, uploaded_at, assignment_tag FROM student_uploads ORDER BY uploaded_at DESC")
        files = cursor.fetchall()
        for f in files: f['uploaded_at'] = f['uploaded_at'].strftime("%Y-%m-%d %H:%M")
        return jsonify({"success": True, "files": files})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/admin/delete-files', methods=['POST'])
def delete_student_files():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    file_ids = request.json.get('file_ids', [])
    if not file_ids: return jsonify({"success": False, "message": "No files selected."})
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        format_strings = ','.join(['%s'] * len(file_ids))
        cursor.execute(f"SELECT filepath FROM student_uploads WHERE id IN ({format_strings})", tuple(file_ids))
        files_to_delete = cursor.fetchall()
        for f in files_to_delete:
            if os.path.exists(f['filepath']):
                try: os.remove(f['filepath'])
                except OSError: pass
        cursor.execute(f"DELETE FROM student_uploads WHERE id IN ({format_strings})", tuple(file_ids))
        conn.commit()
        return jsonify({"success": True, "message": "Files deleted successfully."})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/compare', methods=['POST'])
def compare_files():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    if 'parent' not in request.files or 'child_filepaths' not in request.form:
        return jsonify({"success": False, "message": "Missing parent file or selected student files."})
    parent_file = request.files['parent']
    child_filepaths = request.form['child_filepaths'].split(',')
    parent_text, parent_meta = extract_text_and_metadata(parent_file)
    parent_ngrams = get_hashed_ngrams(parent_text)
    parent_hashes = set(parent_ngrams.keys())
    results = []
    for filepath in child_filepaths:
        if not os.path.exists(filepath): continue 
        child_text, child_meta = extract_text_and_metadata(filepath)
        child_ngrams = get_hashed_ngrams(child_text)
        child_hashes = set(child_ngrams.keys())
        common_hashes = parent_hashes.intersection(child_hashes)
        union_hashes = parent_hashes.union(child_hashes)
        sim_score = round((len(common_hashes) / len(union_hashes)) * 100, 2) if union_hashes else 0
        snippets = [child_ngrams[h] for h in list(common_hashes)[:5]]
        display_name = os.path.basename(filepath).split('_', 1)[-1]
        results.append({
            "filename": display_name, "similarity": sim_score, "similar_content_samples": snippets,
            "hidden_author": child_meta['author'], "hidden_date": child_meta['creation_date']
        })
    results.sort(key=lambda x: x['similarity'], reverse=True)
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            for r in results:
                cursor.execute("""
                    INSERT INTO scan_reports (admin_id, parent_filename, child_filename, similarity, hidden_author, hidden_date) 
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (session['user_id'], parent_file.filename, r['filename'], r['similarity'], r['hidden_author'], r['hidden_date']))
            conn.commit()
        finally:
            if conn.is_connected(): cursor.close(); conn.close()
    return jsonify({"success": True, "results": results})

@app.route('/api/history', methods=['GET'])
def get_history():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM scan_reports WHERE admin_id = %s ORDER BY scanned_at DESC", (session['user_id'],))
        history = cursor.fetchall()
        for h in history: h['scanned_at'] = h['scanned_at'].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify({"success": True, "history": history})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

if __name__ == '__main__':
    app.run(debug=True)