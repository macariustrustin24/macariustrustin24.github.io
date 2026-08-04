import hmac
import os
import re
import secrets
import sqlite3
import urllib.parse

import requests
from flask import Flask, abort, flash, g, jsonify, redirect, render_template, request, Response, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", secrets.token_hex(32)),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true",
)

os.makedirs(app.instance_path, exist_ok=True)
app.config["DATABASE"] = os.path.join(app.instance_path, "playbox.db")

GAMES = [
    {"id": "snake", "title": "Neon Snake", "description": "Grab the stars. Don't hit a wall.", "emoji": "🐍", "accent": "purple", "controls": "Arrow keys / WASD", "goal": "Survive as long as possible."},
    {"id": "tap", "title": "Quick Tap", "description": "Hit every target before the timer ends.", "emoji": "🎯", "accent": "orange", "controls": "Mouse / touch", "goal": "Score as many hits as you can."},
    {"id": "memory", "title": "Flip Match", "description": "Find every pair in the fewest moves.", "emoji": "🧠", "accent": "blue", "controls": "Mouse / touch", "goal": "Finish with the fewest moves."},
    {"id": "jump", "title": "Space Sprint", "description": "Jump over incoming obstacles.", "emoji": "🚀", "accent": "lime", "controls": "Space bar", "goal": "Last as long as you can."},
]
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")


def get_db():
    """Return one SQLite connection per request."""
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


def init_db():
    get_db().executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            game_id TEXT NOT NULL,
            score INTEGER NOT NULL,
            recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, game_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )
    get_db().commit()


def validate_csrf_json():
    data = request.get_json(silent=True) or {}
    token = data.get("csrf_token", "")
    if not hmac.compare_digest(token, session.get("csrf_token", "")):
        abort(400, "Invalid form token. Refresh the page and try again.")


def local_ai_response(prompt: str) -> str:
    normalized = prompt.strip().lower()
    if not normalized:
        return "Ask me anything about the games, the YouTube player, or how to use Playbox."

    if "snake" in normalized:
        return "Neon Snake is all about controlling the head without running into the tail. Use smooth turns, avoid sharp reversals, and chase the food carefully."
    if "tap" in normalized or "target" in normalized:
        return "Quick Tap rewards fast, steady clicks. Keep your eyes on the moving target and don't panic when the speed changes."
    if "memory" in normalized or "flip" in normalized:
        return "Flip Match is a pair game. Start by revealing cards to remember where matching icons are, then clear the board with as few moves as possible."
    if "jump" in normalized or "space" in normalized or "obstacle" in normalized:
        return "Space Sprint is about timing your jumps. Tap space when the obstacle gets close, and land before the next one appears."
    if "youtube" in normalized or "video" in normalized or "play" in normalized:
        return "Use the YouTube player to paste a link or video ID, then press Load video. It plays inside Playbox so you don\'t have to leave the site."
    if "score" in normalized or "best" in normalized:
        return "Your best scores are stored locally and, when you sign in, saved for your account too. Try beating your top score in each game."
    if "account" in normalized or "login" in normalized or "register" in normalized or "signup" in normalized:
        return "Create an account to save your best scores. Log in anytime to continue where you left off."
    if "help" in normalized or "how" in normalized or "what" in normalized:
        return "Ask about any game, how to launch the YouTube player, or how to sign in. I can also give you tips on getting higher scores."

    return "I'm a Playbox helper. I can answer questions about the games and how to use the site." 


def get_user_scores(user_id):
    rows = get_db().execute(
        "SELECT game_id, score FROM user_scores WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    return {row["game_id"]: row["score"] for row in rows}


def save_user_score(user_id, game_id, score):
    db = get_db()
    existing = db.execute(
        "SELECT score FROM user_scores WHERE user_id = ? AND game_id = ?",
        (user_id, game_id),
    ).fetchone()
    if existing is None:
        db.execute(
            "INSERT INTO user_scores (user_id, game_id, score) VALUES (?, ?, ?)",
            (user_id, game_id, score),
        )
        db.commit()
        return True

    if score > existing["score"]:
        db.execute(
            "UPDATE user_scores SET score = ?, recorded_at = CURRENT_TIMESTAMP WHERE user_id = ? AND game_id = ?",
            (score, user_id, game_id),
        )
        db.commit()
        return True

    return False


@app.teardown_appcontext
def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return session["csrf_token"]


def validate_csrf():
    token = request.form.get("csrf_token", "")
    if not hmac.compare_digest(token, session.get("csrf_token", "")):
        abort(400, "Invalid form token. Refresh the page and try again.")


@app.before_request
def load_current_user():
    g.user = None
    user_id = session.get("user_id")
    if user_id is not None:
        g.user = get_db().execute(
            "SELECT id, username, created_at FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if g.user is None:
            session.clear()


@app.context_processor
def inject_template_values():
    return {"current_user": g.user, "csrf_token": csrf_token}


@app.route("/")
def home():
    user_scores = get_user_scores(g.user["id"]) if g.user else {}
    return render_template("index.html", games=GAMES, user_scores=user_scores)


@app.route("/play")
def play():
    user_scores = get_user_scores(g.user["id"]) if g.user else {}
    return render_template("play.html", games=GAMES, user_scores=user_scores)


@app.route("/api/scores", methods=["GET"])
def api_scores():
    if g.user is None:
        return jsonify({"error": "Authentication required."}), 401
    return jsonify({"scores": get_user_scores(g.user["id"])})


@app.route("/api/scores/<game_id>", methods=["POST"])
def api_score_save(game_id):
    if g.user is None:
        return jsonify({"error": "Authentication required."}), 401
    if game_id not in {game["id"] for game in GAMES}:
        abort(404)
    validate_csrf_json()
    try:
        score = int(request.get_json().get("score", 0))
    except (TypeError, ValueError):
        abort(400)
    if score < 0:
        abort(400)

    save_user_score(g.user["id"], game_id, score)
    return jsonify({"game_id": game_id, "best": get_user_scores(g.user["id"]).get(game_id, score)})


@app.route("/api/ai", methods=["POST"])
def api_ai():
    validate_csrf_json()
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "Please provide a question."}), 400

    answer = local_ai_response(prompt)
    return jsonify({"answer": answer})


@app.route("/proxy")
def proxy():
    url = request.args.get("url", "")
    if not url:
        return jsonify({"error": "Missing url parameter."}), 400

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return jsonify({"error": "Invalid URL scheme."}), 400

    allowed_hosts = {"www.youtube.com", "youtube.com", "youtu.be", "i.ytimg.com", "img.youtube.com"}
    if parsed.hostname not in allowed_hosts:
        return jsonify({"error": "Unsupported host."}), 403

    try:
        resp = requests.get(url, headers={"User-Agent": "Playbox/1.0"}, timeout=10, stream=True)
    except requests.RequestException:
        return jsonify({"error": "Unable to fetch URL."}), 502

    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    return Response(resp.content, content_type=content_type)


@app.route("/register", methods=["GET", "POST"])
def register():
    if g.user is not None:
        return redirect(url_for("home"))

    if request.method == "POST":
        validate_csrf()
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        password_confirm = request.form.get("password_confirm", "")

        if not USERNAME_PATTERN.fullmatch(username):
            flash("Use 3–30 letters, numbers, or underscores for your username.", "error")
        elif len(password) < 8:
            flash("Your password needs at least 8 characters.", "error")
        elif len(password) > 128:
            flash("Your password is too long.", "error")
        elif password != password_confirm:
            flash("The passwords do not match.", "error")
        else:
            try:
                db = get_db()
                cursor = db.execute(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    (username, generate_password_hash(password)),
                )
                db.commit()
            except sqlite3.IntegrityError:
                flash("That username is already taken.", "error")
            else:
                session.clear()
                session["user_id"] = cursor.lastrowid
                csrf_token()
                flash("Your Playbox account is ready. Welcome!", "success")
                return redirect(url_for("home"))

    return render_template("auth.html", mode="register")


@app.route("/login", methods=["GET", "POST"])
def login():
    if g.user is not None:
        return redirect(url_for("home"))

    if request.method == "POST":
        validate_csrf()
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = get_db().execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()

        if user is None or not check_password_hash(user["password_hash"], password):
            flash("Username or password was not recognized.", "error")
        else:
            session.clear()
            session["user_id"] = user["id"]
            csrf_token()
            flash(f"Welcome back, {user['username']}!", "success")
            return redirect(url_for("home"))

    return render_template("auth.html", mode="login")


@app.post("/logout")
def logout():
    validate_csrf()
    session.clear()
    flash("You have been signed out.", "success")
    return redirect(url_for("home"))


with app.app_context():
    init_db()


if __name__ == "__main__":
    app.run(debug=True)
