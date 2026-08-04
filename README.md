# Playbox — Python browser games site

A responsive Flask site with four built-in browser games, score persistence, and an embedded YouTube player. It is ready to publish as a GitHub repository.

## Accounts

Playbox includes registration, login, and logout backed by a local SQLite database.
Passwords are stored as secure hashes, forms use CSRF tokens, and the database is created
automatically at `instance/playbox.db` (which is excluded from Git).

For a persistent production session secret, set `SECRET_KEY` before starting the app. On Windows PowerShell:

```powershell
$env:SECRET_KEY = "replace-with-a-long-random-secret"
```

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then visit `http://127.0.0.1:5000`.

## Deploy behind Nginx

The `deploy/` folder contains a standard production setup: Nginx receives
requests for your site and passes them to Gunicorn, which runs this Flask app.
It only serves this application; it is not a public forward proxy.

On an Ubuntu or Debian server you control:

```bash
sudo apt update
sudo apt install nginx python3-venv
sudo mkdir -p /var/www/playbox
sudo chown "$USER":www-data /var/www/playbox
# Copy this repository into /var/www/playbox, then:
cd /var/www/playbox
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
sudo cp deploy/playbox.service /etc/systemd/system/
sudo cp deploy/nginx.conf /etc/nginx/sites-available/playbox
sudo cp deploy/playbox.env.example /etc/playbox.env
sudo chmod 600 /etc/playbox.env
```

Replace `example.com` in `/etc/nginx/sites-available/playbox` with your domain,
then enable and start the services:

```bash
sudo ln -s /etc/nginx/sites-available/playbox /etc/nginx/sites-enabled/playbox
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now playbox nginx
```

For HTTPS, add a certificate after the domain points to your server, for
example with Certbot's Nginx integration.

## Customize

- Add or update game metadata in `app.py`.
- Change the layout in `templates/index.html`, `templates/play.html`, and styling in `static/style.css`.
- Game code lives in `static/games.js`.
- AI chat support is available from the `/play` page via an on-site modal.
- The AI assistant runs locally in the app and does not require OpenAI.
- YouTube player logic lives in `static/youtube.js`.
- Proxy fetches allowed YouTube embed content through `/proxy`.

## Publish to GitHub

Create an empty GitHub repository, then run the following from this folder:

```bash
git init
git add .
git commit -m "Initial portfolio site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
