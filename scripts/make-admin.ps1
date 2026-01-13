docker-compose exec backend sh -c "apk add --no-cache sqlite && sqlite3 /app/data/ghassicloud.db 'SELECT id,username,email,role FROM users;'"

echo "UPDATE users SET role='admin', updated_at=CURRENT_TIMESTAMP WHERE username='YOUR_USERNAME';" | docker-compose exec -T backend sqlite3 /app/data/ghassicloud.db

echo "SELECT username,role FROM users WHERE username='YOUR_USERNAME';" | docker-compose exec -T backend sqlite3 /app/data/ghassicloud.db