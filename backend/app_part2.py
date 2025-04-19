from backend.app_part1 import app, db

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
