UPDATE users SET password_hash = '$2b$12$lwfUMxKeLcsHpYS9AbihT.8HylZ9Pqw7wVXP/OXDnShl.QMy6ov4q';
SELECT email, password_hash FROM users;
