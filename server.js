const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const marked = require('marked');
const sanitizeHtml = require('sanitize-html');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Render Markdown safely
function render(md) {
  const html = marked.parse(md || '');
  return sanitizeHtml(html);
}

// Create tables automatically
pool.query(`
  CREATE TABLE IF NOT EXISTS pages(
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE,
    content TEXT,
    updated TIMESTAMP DEFAULT now()
  )
`).catch(console.error);

// Home
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public/index.html'));
});

// List pages
app.get('/api/pages', async (req,res)=>{
  const r = await pool.query('SELECT * FROM pages ORDER BY title');
  res.json(r.rows);
});

// View
app.get('/api/page/:title', async (req,res)=>{
  const r = await pool.query('SELECT * FROM pages WHERE title=$1',[req.params.title]);
  if(!r.rows.length) return res.status(404).json({error:'Not found'});
  const p = r.rows[0];
  p.rendered = render(p.content);
  res.json(p);
});

// Save (anyone can edit)
app.post('/api/save', async (req,res)=>{
  const { title, content } = req.body;

  await pool.query(`
    INSERT INTO pages(title,content)
    VALUES($1,$2)
    ON CONFLICT(title) DO UPDATE
    SET content=$2, updated=now()
  `,[title,content]);

  res.json({ok:true});
});

// Start
app.listen(PORT, ()=>console.log("Wiki running"));
