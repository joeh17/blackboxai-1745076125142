import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
CORS(app, supports_credentials=True)

# Configuration
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///datalexis.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
Session(app)

# JWT helper functions
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['user_id']).first()
        except Exception as e:
            return jsonify({'error': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# DataFile model
class DataFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)

@app.before_first_request
def create_tables():
    db.create_all()

# Register endpoint
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'})

# Login endpoint with JWT token generation
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(hours=1)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token})
    return jsonify({'error': 'Invalid username or password'}), 401

# Logout endpoint (client should discard token)
@app.route('/api/logout', methods=['POST'])
def logout():
    # Since JWT is stateless, logout is handled client-side by discarding token
    return jsonify({'message': 'Logged out'})

# Check session endpoint (token validation)
@app.route('/api/session', methods=['GET'])
@token_required
def check_session(current_user):
    return jsonify({'username': current_user.username})

# Upload CSV data endpoint
@app.route('/api/data/upload', methods=['POST'])
@token_required
def upload_data(current_user):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    content = file.read().decode('utf-8')
    data_file = DataFile(user_id=current_user.id, filename=file.filename, content=content)
    db.session.add(data_file)
    db.session.commit()
    return jsonify({'message': 'File uploaded successfully', 'file_id': data_file.id})

# List uploaded files for user
@app.route('/api/data/files', methods=['GET'])
@token_required
def list_files(current_user):
    files = DataFile.query.filter_by(user_id=current_user.id).all()
    files_info = [{'id': f.id, 'filename': f.filename} for f in files]
    return jsonify(files_info)

# Get file content by id
@app.route('/api/data/file/<int:file_id>', methods=['GET'])
@token_required
def get_file(current_user, file_id):
    data_file = DataFile.query.get(file_id)
    if not data_file or data_file.user_id != current_user.id:
        return jsonify({'error': 'File not found'}), 404
    return jsonify({'filename': data_file.filename, 'content': data_file.content})

# Placeholder for collaboration features
@app.route('/api/collaboration/share', methods=['POST'])
@token_required
def share_dashboard(current_user):
    # Implement sharing logic here
    return jsonify({'message': 'Collaboration endpoint - to be implemented'})

# Placeholder for advanced analytics
@app.route('/api/analytics/linear_regression', methods=['POST'])
@token_required
def linear_regression(current_user):
    # Implement server-side analytics here
    return jsonify({'message': 'Analytics endpoint - to be implemented'})

if __name__ == '__main__':
    # Run backend on port 5000
    app.run(debug=True, port=5000)
