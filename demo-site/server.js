const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Demo Site</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .card { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 320px; }
        h2 { margin: 0 0 24px; text-align: center; color: #333; }
        input { width: 100%; padding: 10px; margin: 8px 0 16px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #4338ca; }
        .note { margin-top: 16px; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Demo Site Login</h2>
        <form action="/login" method="POST">
          <label>Username</label>
          <input type="text" name="username" placeholder="Enter username" />
          <label>Password</label>
          <input type="password" name="password" placeholder="Enter password" />
          <button type="submit">Login</button>
        </form>
        <p class="note">Unprotected origin — gateway sits in front of this</p>
      </div>
    </body>
    </html>
  `);
});

// Intentionally naive — no auth, no sanitization. The gateway protects this.
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  res.json({ ok: true, message: `Welcome ${username}` });
});

const PORT = process.env.DEMO_SITE_PORT || 4000;
app.listen(PORT, () => console.log(`Demo site listening on ${PORT}`));
