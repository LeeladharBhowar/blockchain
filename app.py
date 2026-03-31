# app.py
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import Error
import hashlib
import PyPDF2
import re

app = Flask(__name__)
# REQUIRED FOR SESSIONS: Change this to a random string in production
app.secret_key = 'super_secret_docuhash_key_123' 

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Leeladhar&01', 
    'database': 'blockchain'
}

def get_db_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# --- NEW: Extract Text AND Hidden Metadata ---
def extract_text_and_metadata(file):
    text = ""
    metadata = {'author': 'Unknown', 'creation_date': 'Unknown'}

    if file.filename.endswith('.pdf'):
        reader = PyPDF2.PdfReader(file)
        
        # 1. Extract Hidden Metadata
        meta = reader.metadata
        if meta:
            metadata['author'] = meta.get('/Author', 'Unknown')
            raw_date = meta.get('/CreationDate', 'Unknown')
            
            # Clean up the ugly PDF date format (e.g., D:20231025143000Z -> 2023-10-25 14:30)
            if raw_date != 'Unknown' and raw_date.startswith('D:'):
                metadata['creation_date'] = f"{raw_date[2:6]}-{raw_date[6:8]}-{raw_date[8:10]} {raw_date[10:12]}:{raw_date[12:14]}"

        # 2. Extract Text
        for page in reader.pages:
            text += page.extract_text() + " "
    else:
        # Plain text files don't have this kind of metadata
        text = file.read().decode('utf-8', errors='ignore')

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

# --- PAGE ROUTES ---
@app.route('/')
def welcome():
    return render_template('welcome.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard_page():
    # Protect this page: if no user in session, redirect to login
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('dashboard.html', name=session.get('user_name'))

# --- API ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name, email, password = data.get('name'), data.get('email'), data.get('password')

    if not re.match(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$', password):
        return jsonify({"success": False, "message": "Password does not meet security requirements."})

    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()
    if not conn: return jsonify({"success": False, "message": "Database error"})

    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)", (name, email, hashed_pw))
        conn.commit()
        return jsonify({"success": True, "message": "Registered successfully. Redirecting..."})
    except mysql.connector.IntegrityError:
        return jsonify({"success": False, "message": "Email already exists."})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email, password = data.get('email'), data.get('password')
    
    conn = get_db_connection()
    if not conn: return jsonify({"success": False, "message": "Database error"})

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, password_hash FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password_hash'], password):
            # Save user to session
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            return jsonify({"success": True})
        return jsonify({"success": False, "message": "Invalid credentials."})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear() # Destroy the session
    return jsonify({"success": True})

@app.route('/api/compare', methods=['POST'])
def compare_files():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    if 'parent' not in request.files or 'children' not in request.files:
        return jsonify({"success": False, "message": "Missing files"})

    parent_file = request.files['parent']
    child_files = request.files.getlist('children')

    # --- NEW: Process Parent File Metadata ---
    parent_text, parent_meta = extract_text_and_metadata(parent_file)
    parent_ngrams = get_hashed_ngrams(parent_text)
    parent_hashes = set(parent_ngrams.keys())

    results = []
    for child in child_files:
        # --- NEW: Process Child File Metadata ---
        child_text, child_meta = extract_text_and_metadata(child)
        child_ngrams = get_hashed_ngrams(child_text)
        child_hashes = set(child_ngrams.keys())

        common_hashes = parent_hashes.intersection(child_hashes)
        union_hashes = parent_hashes.union(child_hashes)
        
        sim_score = round((len(common_hashes) / len(union_hashes)) * 100, 2) if union_hashes else 0
        snippets = [child_ngrams[h] for h in list(common_hashes)[:5]]

        # --- NEW: Append Metadata to Results payload ---
        results.append({
            "filename": child.filename, 
            "similarity": sim_score, 
            "similar_content_samples": snippets,
            "hidden_author": child_meta['author'],
            "hidden_date": child_meta['creation_date']
        })

    results.sort(key=lambda x: x['similarity'], reverse=True)
    return jsonify({"success": True, "results": results})

if __name__ == '__main__':
    app.run(debug=True)

@app.route('/api/compare', methods=['POST'])
def compare_files():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    if 'parent' not in request.files or 'children' not in request.files:
        return jsonify({"success": False, "message": "Missing files"})

    parent_file = request.files['parent']
    child_files = request.files.getlist('children')

    parent_text, parent_meta = extract_text_and_metadata(parent_file)
    parent_ngrams = get_hashed_ngrams(parent_text)
    parent_hashes = set(parent_ngrams.keys())

    results = []
    for child in child_files:
        child_text, child_meta = extract_text_and_metadata(child)
        child_ngrams = get_hashed_ngrams(child_text)
        child_hashes = set(child_ngrams.keys())

        common_hashes = parent_hashes.intersection(child_hashes)
        union_hashes = parent_hashes.union(child_hashes)
        
        sim_score = round((len(common_hashes) / len(union_hashes)) * 100, 2) if union_hashes else 0
        snippets = [child_ngrams[h] for h in list(common_hashes)[:5]]

        results.append({
            "filename": child.filename, 
            "similarity": sim_score, 
            "similar_content_samples": snippets,
            "hidden_author": child_meta['author'],
            "hidden_date": child_meta['creation_date']
        })

    results.sort(key=lambda x: x['similarity'], reverse=True)

    # --- NEW: Save Results to MySQL Database ---
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            for r in results:
                cursor.execute("""
                    INSERT INTO scan_reports 
                    (admin_id, parent_filename, child_filename, similarity, hidden_author, hidden_date) 
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (session['user_id'], parent_file.filename, r['filename'], r['similarity'], r['hidden_author'], r['hidden_date']))
            conn.commit()
        except Exception as e:
            print(f"Failed to save history: {e}")
        finally:
            if conn.is_connected(): cursor.close(); conn.close()

    return jsonify({"success": True, "results": results})

# --- NEW: Fetch Scan History Route ---
@app.route('/api/history', methods=['GET'])
def get_history():
    if 'user_id' not in session: return jsonify({"success": False, "message": "Unauthorized"})
    
    conn = get_db_connection()
    if not conn: return jsonify({"success": False, "message": "Database error"})

    try:
        cursor = conn.cursor(dictionary=True)
        # Fetch history for the logged-in admin, newest first
        cursor.execute("SELECT * FROM scan_reports WHERE admin_id = %s ORDER BY scanned_at DESC", (session['user_id'],))
        history = cursor.fetchall()
        
        # Format the dates for JavaScript
        for h in history:
            h['scanned_at'] = h['scanned_at'].strftime("%Y-%m-%d %H:%M:%S")
            
        return jsonify({"success": True, "history": history})
    except Error as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if conn.is_connected(): cursor.close(); conn.close()

if __name__ == '__main__':
    app.run(debug=True)