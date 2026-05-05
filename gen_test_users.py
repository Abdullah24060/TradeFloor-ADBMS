import bcrypt

users = [
    ('Ali Raza',    'ali.test@itu.edu.pk',   'BSAI-2024', 'BS Artificial Intelligence'),
    ('Sara Khan',   'sara.test@itu.edu.pk',  'BSCS-2023', 'BS Computer Science'),
    ('Omar Sheikh', 'omar.test@itu.edu.pk',  'BSSE-2024', 'BS Software Engineering'),
]

print("INSERT INTO users (name, email, password_hash, is_verified, reputation, batch, degree) VALUES")
rows = []
for name, email, batch, degree in users:
    h = bcrypt.hashpw(b'Test@1234', bcrypt.gensalt(rounds=12)).decode()
    rows.append("('{}', '{}', '{}', TRUE, 0, '{}', '{}')".format(name, email, h, batch, degree))

print(',\n'.join(rows) + ';')
