from flask_jwt_extended import create_access_token, create_refresh_token


def make_tokens(user) -> tuple:
    identity = {
        'sub':         str(user.id),
        'username':    user.username,
        'is_admin':    user.is_admin,
        'is_approved': user.is_approved,
    }
    access_token  = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)
    return access_token, refresh_token
