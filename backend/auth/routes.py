import logging
from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    get_jwt,
    create_access_token,
    decode_token,
)
from auth.models import db, User
from auth.tokens import make_tokens

auth_bp = Blueprint('auth', __name__)
logger  = logging.getLogger(__name__)


_revoked_jtis: set = set()


def is_token_revoked(jwt_header: dict, jwt_payload: dict) -> bool:
    return jwt_payload.get('jti', '') in _revoked_jtis


@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()

    if not all([data.get('username'), data.get('email'), data.get('password')]):
        return jsonify({'error': 'username, email, and password are required'}), 400

    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    exists = User.query.filter(
        (User.username == data['username']) | (User.email == data['email'])
    ).first()
    if exists:
        return jsonify({'error': 'Username or email already taken'}), 409

    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    logger.info(
        'signup username=%s request_id=%s',
        user.username,
        getattr(g, 'request_id', 'no-id'),
    )

    return jsonify({'message': 'Account created. Awaiting approval.'}), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.get_json()
    username = data.get('username', '')

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(data.get('password', '')):
        logger.warning(
            'login_failed username=%s request_id=%s',
            username,
            getattr(g, 'request_id', 'no-id'),
        )
        return jsonify({'error': 'Invalid username or password'}), 401

    access_token, refresh_token = make_tokens(user)

    logger.info(
        'login_success username=%s request_id=%s',
        user.username,
        getattr(g, 'request_id', 'no-id'),
    )

    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user':          user.to_dict(),
    }), 200


@auth_bp.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity     = get_jwt_identity()
    access_token = create_access_token(identity=identity)

    logger.info(
        'token_refreshed sub=%s request_id=%s',
        identity.get('sub'),
        getattr(g, 'request_id', 'no-id'),
    )

    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    identity = get_jwt_identity()
    user     = User.query.get(int(identity['sub']))

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(user.to_dict()), 200


@auth_bp.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    _revoked_jtis.add(get_jwt()['jti'])

    body          = request.get_json(silent=True) or {}
    refresh_token = body.get('refresh_token')

    if refresh_token:
        try:
            decoded = decode_token(refresh_token)
            _revoked_jtis.add(decoded['jti'])
        except Exception:
            pass

    logger.info(
        'logout sub=%s request_id=%s',
        get_jwt_identity().get('sub'),
        getattr(g, 'request_id', 'no-id'),
    )

    return jsonify({'message': 'Logged out'}), 200
