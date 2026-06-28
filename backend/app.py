import os
import logging
from flask import Flask, request, g
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv
from auth.models import db
from auth.routes import auth_bp, is_token_revoked

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

app.config['SECRET_KEY']              = os.environ['SECRET_KEY']
app.config['JWT_SECRET_KEY']          = os.environ['JWT_SECRET_KEY']
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///securebff.db'
)

CORS(app, origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')])

db.init_app(app)

jwt = JWTManager(app)


@jwt.token_in_blocklist_loader
def check_if_revoked(jwt_header, jwt_payload):
    return is_token_revoked(jwt_header, jwt_payload)


@app.before_request
def capture_request_id():
    g.request_id = request.headers.get('X-Request-ID', 'no-id')


app.register_blueprint(auth_bp)

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
