"""The smallest Flask app: two routes.  Run: web start app.py"""
from flask import Flask, request
from markupsafe import escape

app = Flask(__name__)


@app.get("/")
def home():
    return "<h1>Hello, Flask!</h1><p>Try /hello?name=Mina</p>"


@app.get("/hello")
def hello():
    name = request.args.get("name", "world")
    # escape(): a name like <b>hi</b> is shown as text, not run as HTML
    return f"<p>Hello, {escape(name)}!</p>"


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
