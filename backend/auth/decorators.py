from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity


def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if not get_jwt_identity().get('is_admin'):
            return {'error': 'Admin access required'}, 403
        return fn(*args, **kwargs)
    return wrapper


def approved_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        if not identity.get('is_approved') and not identity.get('is_admin'):
            return {'error': 'Your account is pending approval'}, 403
        return fn(*args, **kwargs)
    return wrapper
