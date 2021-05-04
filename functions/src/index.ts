import express from 'express';
import cookie from 'cookie';
import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function addCookie(res: any, key: string, value: string) {
  const expiresIn = 60 * 60 * 24;
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(key, value, {
      maxAge: expiresIn,
      httpOnly: true,
    })
  );
}

const apiRouter = express.Router();

apiRouter
  .get('/cookies', (req, res) => {
    res.setHeader('Cache-Control', 'private');
    const cookies = cookie.parse(req.headers.cookie || '');
    res.send(cookies);
  })
  .post('/cookie', (req, res) => {
    res.setHeader('Cache-Control', 'private');
    addCookie(res, req.body.key, req.body.value);
    res.send('save cookies');
  });

app.use('/api', apiRouter);

export const api = functions.https.onRequest(app);
