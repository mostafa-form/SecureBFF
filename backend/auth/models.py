from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import bcrypt

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id          = db.Column(db.Integer,     primary_key=True)
    username    = db.Column(db.String(80),  unique=True, nullable=False)
    email       = db.Column(db.String(120), unique=True, nullable=False)
    password    = db.Column(db.String(256), nullable=False)
    is_admin    = db.Column(db.Boolean,     default=False, nullable=False)
    is_approved = db.Column(db.Boolean,     default=False, nullable=False)
    created_at  = db.Column(db.DateTime,    default=datetime.utcnow)

    def set_password(self, raw_password: str) -> None:
        self.password = bcrypt.hashpw(
            raw_password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, raw_password: str) -> bool:
        return bcrypt.checkpw(
            raw_password.encode('utf-8'),
            self.password.encode('utf-8')
        )

    def to_dict(self) -> dict:
        return {
            'id':          self.id,
            'username':    self.username,
            'email':       self.email,
            'is_admin':    self.is_admin,
            'is_approved': self.is_approved,
        }
